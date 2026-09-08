import {Router} from "express"
import {sendRegistrationOtp} from "../controller/auth.controller"

const router = Router()

router.post("/register/send-otp", sendRegistrationOtp);

export default router;