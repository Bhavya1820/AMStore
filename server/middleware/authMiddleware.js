import jwt from "jsonwebtoken"

function authenticate(req, res, next){
  let token;
  const authHeader = req.headers.autherization;
  if(authHeader && authHeader.startWith("Bearer ")){
    token = authHeader.split(" ")[1];
  }

  if(!token && req.headers.bearer){
    token = req.headers.bearer
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).json({message: "Invalid token"})
    }

    req.user = decoded;
    next();
  });
}

export default authenticate;