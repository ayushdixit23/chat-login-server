import { Request, Response } from "express";
import asyncHandler from "../middlewares/tryCatch.js";
import User from "../models/user.js";
import { generateToken } from "../utils/jwt.js";
import bcrypt from "bcryptjs";
import { CustomError } from "../middlewares/errors/CustomError.js";
import { uploadToS3 } from "../helpers/s3.config.js";
import { BUCKET_NAME, CLOUDFRONT_URL } from "../utils/envConfig.js";
import { getUniqueMediaName } from "../utils/utils.js";

const checkUserExists = async (email: string, userName: string) => {
  // Use a single query to check if either the email or username exists
  const user = await User.findOne({ $or: [{ email }, { userName }] });

  if (user) {
    if (user.userName === userName) {
      throw new CustomError("Username already exists", 409);
    }

    if (user.email === email) {
      throw new CustomError("Email already exists", 409);
    }
  }
};

const generateUsername = (fullName: string) => {
  if (!fullName) {
    throw new Error("Full name is required");
  }

  let username = fullName.toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
  const randomNum = Math.floor(Math.random() * 100);
  username += randomNum;
  return username;
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    throw new CustomError("Email and password are required", 400);
  }

  // Check if email exists in the database
  const user = await User.findOne({ email });
  if (!user) {
    throw new CustomError("Invalid email or password", 401);
  }

  if (user.password) {
    const isPasswordMatch = await bcrypt.compare(password, user?.password);

    if (!isPasswordMatch) {
      throw new CustomError("Invalid email or password", 401);
    }

    const data = {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      userName: user.userName,
      about: user.bio,
    };

    const token = generateToken(data);

    return res
      .status(200)
      .json({ message: "Login successful", token, user: data, success: true });
  } else {
    throw new CustomError(
      "This account is linked with Google, please log in using Google.",
      401
    );
  }
});

export const registerUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { fullName, userName, email, password } = req.body;

    if (!req.file) {
      throw new CustomError("Profile image is required", 400);
    }

    if (!fullName || !userName || !email || !password) {
      throw new CustomError("All fields are required", 400);
    }

    await checkUserExists(email, userName);

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw new CustomError("Email already exists", 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const profilePic = getUniqueMediaName(req.file.originalname);

    const fullPath = `profilePics/${profilePic}`;

    // Create a new user
    const user = new User({
      fullName,
      userName,
      email,
      password: hashedPassword,
      profilePic: `${CLOUDFRONT_URL}${fullPath}`,
    });

    await Promise.all([
      uploadToS3(BUCKET_NAME, fullPath, req.file.buffer, req.file.mimetype),
      user.save(),
    ]);

    return res.status(200).json({
      message: "User registered successfully",
      success: true,
    });
  }
);

export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, fullName, image, id } = req.body;

  if (!email) {
    throw new CustomError("Email is required", 400);
  }
  const user = await User.findOne({ email });

  if (user) {
    const data = {
      id: user._id.toString(),
      userName: user.userName,
      fullName: user.fullName,
      profilePic: user.profilePic,
      email: user.email,
      about: user.bio,
    };

    const token = generateToken(data);
    return res
      .status(200)
      .json({ succcess: true, user: data, message: "Login successful", token });
  } else {
    const userName = generateUsername(fullName);

    const newUser = new User({
      email,
      fullName,
      profilePic: image,
      userName,
      isGoogleUser: true,
      googleId: id,
    });

    await newUser.save();

    const data = {
      id: newUser._id.toString(),
      userName: newUser.userName,
      fullName: newUser.fullName,
      profilePic: image,
      email: newUser.email,
      about: newUser.bio,
    };

    const token = generateToken(data);

    return res.status(200).json({
      token,
      user: data,
      success: true,
      message: "Account Created && Login successful",
    });
  }
});

export const changeSetting = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const {
      name: fullName,
      username: userName,
      about: bio,
      email,
    } = req.body;

    if (!fullName || !userName || !bio || !email) {
      res.status(400).json({ message: "All fields are required!" });
      return;
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { userName }],
      _id: { $ne: userId }, // Exclude the current user
    });

    if (existingUser) {
      // If found, send an error message
      if (existingUser.email === email) {
       
        throw new CustomError("Email is already in use!", 400);
      }
      if (existingUser.userName === userName) {
        throw new CustomError("Username is already taken!", 400);
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Update the user's settings
    user.fullName = fullName;
    user.userName = userName;
    user.bio = bio;
    user.email = email;

    let profilePic = null

    if (req.file) {
      const image = getUniqueMediaName(req.file.originalname);
      const fullPath = `profilePics/${image}`;
      uploadToS3(BUCKET_NAME, fullPath, req.file.buffer, req.file.mimetype),
        profilePic = `${CLOUDFRONT_URL}${fullPath}`
      user.profilePic = profilePic;
    }

    // Save the updated user to the database
    const updatedUser = await user.save();

    // Return the updated user data
    res.status(200).json({
      message: "Settings updated successfully!",
      user: updatedUser,
      success: true,
      profilePic: profilePic ? profilePic : null
    });
  }
);
