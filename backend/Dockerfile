# Imagen oficial de Node.js Alpine liviana
FROM node:22-alpine

WORKDIR /app

# Copiar manifiestos e instalar dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el código fuente
COPY . .

# Crear carpeta de datos para persistencia de la base de datos
RUN mkdir -p /app/data

# Exponer el puerto
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicio
CMD ["npm", "start"]
