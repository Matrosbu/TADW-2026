#!/bin/bash
set -e
echo "========================================="
echo "Inicializando Base de Datos peliculas-proyectos"
echo "========================================="

gunzip -k -f /docker-entrypoint-initdb.d/movies.json.gz
gunzip -k -f /docker-entrypoint-initdb.d/reviews.json.gz

echo "Importando coleccion movies..."
mongoimport --db peliculas-proyectos --collection movies --file /docker-entrypoint-initdb.d/movies.json

echo "Importando coleccion reviews..."
mongoimport --db peliculas-proyectos --collection reviews --file /docker-entrypoint-initdb.d/reviews.json

echo "Creando indices iniciales..."
mongosh peliculas-proyectos --eval '
    db.movies.createIndex({ title: 1 });
    db.movies.createIndex({ year: 1 });
    db.reviews.createIndex({ movie_id: 1 });
    db.reviews.createIndex({ user_id: 1 });
    db.reviews.createIndex({ movie_id: 1, user_id: 1 });
'

rm -f /docker-entrypoint-initdb.d/movies.json /docker-entrypoint-initdb.d/reviews.json
echo "Inicializacion completada con exito."
