import express from "express"
import { changeSetting, googleLogin, login, registerUser } from "../controllers/auth.js"
import upload from "../middlewares/multer.js"
import { verifyUserToken } from "../middlewares/auth.js"

const router = express.Router()

router.post(`/login`, login)
router.post(`/register`, upload.single("profilePic"), registerUser)
router.post(`/google`, googleLogin)
router.post(`/settings`, verifyUserToken, upload.single("profilePic"), changeSetting)
router.get(`/check`, (req, res) => {
    res.status(200).json({ success: true, message: "All good here in login service!", req: req.path })
})


export default router