import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import {
  static as expressStatic,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import path from "node:path";
import { AppModule } from "./app.module";
import { isAllowedSessionRequestOrigin } from "./security/request-origin";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api/v1");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use("/uploads", expressStatic(path.resolve(process.cwd(), "uploads")));
  app.use(cookieParser());
  const webUrl = config.get("WEB_URL", "http://localhost:3000");
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (
      !isAllowedSessionRequestOrigin({
        method: request.method,
        hasSessionCookie: Boolean(request.cookies?.tws_session),
        origin: request.get("origin"),
        webUrl,
      })
    ) {
      return response.status(403).json({
        message: "Nguồn yêu cầu không hợp lệ",
      });
    }
    return next();
  });
  app.enableCors({
    origin: webUrl,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("TWS Community Marketplace API")
      .setDescription("API cho marketplace mua bán cộng đồng TWS")
      .setVersion("1.0")
      .addCookieAuth("tws_session")
      .build(),
  );
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(config.get("PORT", 4000));
}

void bootstrap();
