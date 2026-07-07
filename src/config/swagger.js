const swaggerJsdoc = require("swagger-jsdoc");
const config = require("./index");

const serverUrl =
  config.app.env === "production"
    ? `http://${config.app.ec2Ip}/api/v1`
    : `http://localhost:${config.app.port}/api/v1`;

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AI Knowledge Base API",
      version: "1.0.0",
      description: "API documentation for AI Knowledge Base",
    },
    servers: [
      {
        url: serverUrl,
        description:
          config.app.env === "production"
            ? "Production server"
            : "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
