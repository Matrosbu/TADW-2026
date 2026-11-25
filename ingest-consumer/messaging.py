import asyncio
import logging
import os

import aio_pika

logger = logging.getLogger("ingest-consumer")


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


class RabbitConsumer:
    def __init__(self):
        self.connection = None
        self.channel = None

    async def connect(self):
        host = os.getenv("RABBITMQ_HOST", "rabbitmq")
        port = int(os.getenv("RABBITMQ_PORT", "5672"))
        user = os.getenv("RABBITMQ_USER", "flix")
        password = os.getenv("RABBITMQ_PASSWORD", "dev_only_change_me")

        for attempt, delay in enumerate((1, 2, 4, 8, 8), start=1):
            try:
                self.connection = await aio_pika.connect_robust(
                    host=host,
                    port=port,
                    login=user,
                    password=password,
                    timeout=3,
                    reconnect_interval=2,
                )
                self.channel = await self.connection.channel()
                await self.channel.set_qos(prefetch_count=1)
                await declare_topology(self.channel)
                return
            except Exception as exc:
                logger.warning("intento=%s RabbitMQ falló: %s", attempt, type(exc).__name__)
                await asyncio.sleep(delay)
        raise RuntimeError("RabbitMQ no disponible")

    async def close(self):
        if self.connection:
            await self.connection.close()
