# Utilise une image de base pour Node.js
FROM node:22

# Définit le répertoire de travail dans le conteneur
WORKDIR /app

ARG BUILD_ENV
ENV BUILD_ENV=${BUILD_ENV}

# Copie les fichiers package.json et package-lock.json
COPY package*.json ./

# Installe les dépendances
RUN npm install

# Copie le reste des fichiers de l'application
COPY . .

# Construit l'application pour la production
RUN npm run build -- --configuration ${BUILD_ENV}

# Utilise une image de base pour servir les fichiers statiques
FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf

# Copie les fichiers construits dans le répertoire de Nginx
COPY --from=0 /app/dist/*/browser /usr/share/nginx/html

# Expose le port 80
EXPOSE 80

# Commande par défaut pour démarrer Nginx
ENTRYPOINT ["nginx", "-c", "/etc/nginx/nginx.conf"]
CMD ["-g", "daemon off;"]