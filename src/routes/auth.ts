import express from "express"
import { googleLogin, login, registerUser } from "../controllers/auth.js"
import upload from "../middlewares/multer.js"
import { verifyUserToken } from "../middlewares/auth.js"

const router = express.Router()

router.post(`/login`, login)
router.post(`/register`, upload.single("profilePic"), registerUser)
router.post(`/google`, googleLogin)
router.get(`/verify`, verifyUserToken, (req, res) => {
    console.log(req.user)
    res.status(200).json({ user: req.user, message: "Protected route accessed!", success: true })
})

export default router