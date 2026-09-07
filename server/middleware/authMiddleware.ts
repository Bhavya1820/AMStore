import jwt, { decode, JwtPayload } from "jsonwebtoken"
import { Request, Response, NextFunction } from "express"

function authenticate(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token && req.headers.bearer) {
    token = req.headers.bearer as string;
  }

  if (!token) {
    return res.status(401).json({
      message: "No token provided"
    })
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: "JWT secret is not configured" });
  }
  
  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export default authenticate;