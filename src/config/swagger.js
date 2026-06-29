const swaggerJsdoc = require("swagger-jsdoc");
const config = require("./index");

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
        url: `http://localhost:${config.app.port}/api/v1`,
        description: "Development server",
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
  },
  apis: ["./src/routes/*.js"], // reads JSDoc comments from route files
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
