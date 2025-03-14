import express from "express"
import { changeSetting, googleLogin, login, registerUser } from "../controllers/auth.js"
import upload from "../middlewares/multer.js"
import { verifyUserToken } from "../middlewares/auth.js"

const router = express.Router()

router.post(`/login`, login)
router.post(`/register`, upload.single("profilePic"), registerUser)
router.post(`/google`, googleLogin)
router.post(`/settings`, verifyUserToken, upload.single("profilePic"), changeSetting)

export default router