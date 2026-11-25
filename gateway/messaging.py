import asyncio
import json
import os

import aio_pika


async def declare_topology(channel):
    dead_exchange = await channel.declare_exchange(
        "interactions.dlx", aio_pika.ExchangeType.DIRECT, durable=True
    )
    dead_queue = await channel.declare_queue("interactions.dead", durable=True)
    await dead_queue.bind(dead_exchange, routing_key="interactions")
    await channel.declare_queue(
        "interactions",
        durable=True,
        arguments={
            "x-dead-letter-exchange": "interactions.dlx",
            "x-dead-letter-routing-key": "interactions",
        },
    )


class RabbitPublisher:
    def __init__(self):
        self.connection = None
        self.channel = None

    async def connect(self):
        host = os.getenv("RABBITMQ_HOST", "rabbitmq")
        port = int(os.getenv("RABBITMQ_PORT", "5672"))
        user = os.getenv("RABBITMQ_USER", "flix")
        password = os.getenv("RABBITMQ_PASSWORD", "dev_only_change_me")

        for delay in (1, 2, 4, 8, 8):
            try:
                self.connection = await aio_pika.connect_robust(
                    host=host,
                    port=port,
                    login=user,
                    password=password,
                    timeout=3,
                    reconnect_interval=2,
                )
                self.channel = await self.connection.channel(publisher_confirms=True)
                await declare_topology(self.channel)
                return
            except Exception:
                await asyncio.sleep(delay)
        raise RuntimeError("RabbitMQ no disponible")

    async def close(self):
        if self.connection:
            await self.connection.close()

    async def publish(self, message, interaction_id):
        if (
            self.connection is None
            or self.connection.is_closed
            or self.channel is None
            or self.channel.is_closed
        ):
            raise RuntimeError("RabbitMQ no disponible")

        payload = json.dumps(message, ensure_ascii=False).encode("utf-8")
        await self.channel.default_exchange.publish(
            aio_pika.Message(
                body=payload,
                content_type="application/json",
                message_id=interaction_id,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key="interactions",
            timeout=3,
        )
