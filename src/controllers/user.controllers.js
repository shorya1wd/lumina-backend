import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import { deleteOnR2, extractPublicId } from "../utils/r2.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/email.js";
import crypto from "crypto";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
import { WatchHistory } from "../models/watchHistory.models.js";
import { uploadOnR2 } from "../utils/r2.js";

const generateAccessAndRefreshToken=async(userId)=>{
    try {
        const user=await User.findById(userId)
        if(!user){
            throw new ApiError(400,"User not found")
        }
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()
    
        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    } catch (error) {
        console.log(error)
        throw new ApiError(500,"Couldn't generate access and refresh token")
    }
}

const registerUser=asyncHandler(async(req,res)=>{
    const {email,password,username,fullname}=req.body

    if([email,password,username,fullname].some((f)=>f?.trim()==="" || !f)){
        throw new ApiError(400,"All fields are required")
    }

    const existingUser=await User.findOne({
        $or:[{email},{username}]
    })

    if(existingUser){
        throw new ApiError(409,"A user with this email or username already exists")
    }

    const avatarLocalPath=req.files?.avatar?.[0]?.path
    const coverImageLocalPath=req.files?.coverImage?.[0]?.path

    let avatarUrl=undefined
    let coverImageUrl=undefined
    let avatar
    let coverImage

    if(avatarLocalPath){
        avatar=await uploadOnR2(avatarLocalPath, "avatars")
        if(avatar){
            avatarUrl=avatar.url
        }
    }
    if(coverImageLocalPath){
        coverImage=await uploadOnR2(coverImageLocalPath, "covers")
        if(coverImage){
            coverImageUrl=coverImage.url
        }
    }
    
    try {
        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verifyCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        const user=await User.create({
            fullname,
            username,
            email,
            password,
            avatar:avatarUrl,
            coverImage:coverImageUrl,
            isVerified: false,
            verifyCode,
            verifyCodeExpiry
        })
        
        // Send email in the background to prevent blocking
        sendVerificationEmail(email, verifyCode).catch((err) => {
            console.log("Failed to send verification email:", err.message);
        });

        const createdUser=await User.findById(user._id).select("-password -refreshToken -verifyCode -forgotPasswordToken")
    
        if(!createdUser){
            throw new ApiError(500,"Something went wrong while registering user")
        }
    
        return res.status(201).json(new ApiResponse(201,createdUser,"User registered successfully"))
    } catch (error) {
        console.log("User creation failed",error)
        if(avatar){
            await deleteOnR2(avatar.key)
        }
        if(coverImage){
            await deleteOnR2(coverImage.key)
        }
        throw new ApiError(500,`Something went wrong while registering user and images were deleted ${error.message}`)
    }
})

const loginUser=asyncHandler(async(req,res)=>{
    const {email,username,password}=req.body

    if(!password){
        throw new ApiError(400,"Password is required")
    }
    if(!email && !username){
        throw new ApiError(400,"Email or username required")
    }

    const user=await User.findOne({$or:[{email},{username}]})

    if(!user){
        throw new ApiError(404,"User not found")
    }

    const userPasswordIsCorrect=await user.isPasswordCorrect(password)

    if(!userPasswordIsCorrect){
        throw new ApiError(401,"Password is Incorrect! Try again.")
    }

    if (!user.isVerified) {
        throw new ApiError(403, "Please verify your email address to login");
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id)

    const loggedInUser=await User.findById(user._id).select("-password -refreshToken")

    if(!loggedInUser){
        throw new ApiError(404,"User not found")
    }
   
    const accessTokenOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 1 * 24 * 60 * 60 * 1000
};

const refreshTokenOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 10 * 24 * 60 * 60 * 1000
};

    res.status(200)
        .cookie("accessToken",accessToken,accessTokenOptions)
        .cookie("refreshToken",refreshToken,refreshTokenOptions)
        .json(new ApiResponse(200,{user:loggedInUser,accessToken,refreshToken},"User logged in successfully"))

})

const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Refresh Token not found")
    }

    try {
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

        const user=await User.findById(decodedToken?._id)

        if(!user){
            throw new ApiError(401,"invalid refresh token")
        }

        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401,"Refresh token is expired")
        }

        const accessTokenOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 1 * 24 * 60 * 60 * 1000
};

const refreshTokenOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 10 * 24 * 60 * 60 * 1000
}

        const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id)

        return res.status(200).cookie("accessToken",accessToken,accessTokenOptions).cookie("refreshToken",refreshToken,refreshTokenOptions)
            .json(new ApiResponse(200,{accessToken,refreshToken},"Access and refresh Token generated Successfully"))

    } catch (error) {
        console.log(error)
        throw new ApiError(401, error?.message || "Invalid or expired refresh token")
    }
})

const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1
            }       
        },
        {
            returnDocument: 'after'
        }
    )

    const options = {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
};

    res.status(200).clearCookie("accessToken",options).clearCookie("refreshToken",options)
        .json(new ApiResponse(200,{},"User logged out successfully"))

})

const changeCurrentPassword=asyncHandler(async(req,res)=>{
    const {currentPassword,newPassword}=req.body

    if (!currentPassword || !newPassword) {
        throw new ApiError(400, "Both current password and new password are required");
    }

    const user=await User.findById(req.user?._id)

    if(!user){
        throw new ApiError(404,"User not found")
    }

    const isPasswordCorrect=await user.isPasswordCorrect(currentPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Current Password is not correct")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200).json(new ApiResponse(200,{},"Password changed successfully"))

})

const getCurrentUser=asyncHandler(async(req,res)=>{

    return res.status(200).json(new ApiResponse(200,req.user,"Current User Fetched Successfully"))

})

const updateProfileDetails=asyncHandler(async(req,res)=>{
    const {fullname,username}=req.body

    if(!fullname && !username){
        throw new ApiError(400,"fullname or username required")
    }

    const updateFields={}

    if(fullname){
        updateFields.fullname=fullname
    }
    if(username){
        updateFields.username=username
    }

    const user=await User.findByIdAndUpdate(req.user._id,
        {
            $set:updateFields
        },
        {
            returnDocument: 'after'
        }
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200,user,"Profile Details updated successfully"))

})

const updateUserAvatar=asyncHandler(async(req,res)=>{

    const avatarLocalPath=req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar=await uploadOnR2(avatarLocalPath, "avatars")

    if(!avatar || !avatar.url){
        throw new ApiError(400,"image couldnt upload on R2")
    }

    const currentUser=await User.findById(req.user._id)
    const oldAvatarUrl=currentUser.avatar

    const user=await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
            avatar:avatar.url
            }
        },
        {
            returnDocument: 'after'
        }
    ).select("-password -refreshToken")

    if(oldAvatarUrl){
        const publicId=extractPublicId(oldAvatarUrl)
        await deleteOnR2(publicId)
    }

    return res.status(200).json(new ApiResponse(200,user,"Avatar Updated Successfully"))

})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Image not found")
    }

    const coverImage=await uploadOnR2(coverImageLocalPath, "covers")

    if(!coverImage || !coverImage.url){
        throw new ApiError(404,"Image upload on R2 failed")
    }

    const currentUser=await User.findById(req.user._id)
    const oldCoverImageUrl=currentUser.coverImage

    const user=await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        { returnDocument: 'after'}
    ).select("-password -refreshToken")

    if(oldCoverImageUrl){
        const publicId=extractPublicId(oldCoverImageUrl)
        await deleteOnR2(publicId)
    }

    return res.status(200).json(new ApiResponse(200,user,"Cover Image changed Successfully"))
})

const getUserChannelProfile=asyncHandler(async(req,res)=>{

    const {username}=req.params

    if(!username?.trim()){
        throw new ApiError(400,"Username not found")
    }

    const channelInfo=await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                isSubscribed:{
                    $cond:{
                        if:{
                            $in:[req.user?._id,"$subscribers.subscriber"]
                        },
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username:1,
                avatar:1,
                coverImage:1,
                subscribersCount:1,
                isSubscribed:1
            }
        }
    ])

    if(!channelInfo?.length){
        throw new ApiError(404,"Channel not found")
    }

    return res.status(200).json(new ApiResponse(200,channelInfo[0],"Channel Profile fetched successfully"))

})

const getWatchHistory=asyncHandler(async(req,res)=>{
    const watchHistory=await WatchHistory.aggregate([
        {
            $match:{
                user:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $sort:{
                createdAt:-1
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"video",
                foreignField:"_id",
                as:"videoDetails",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind:"$videoDetails"
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                watchHistory,
                "Watch history fetched successfully"
            )
        );

})

const verifyEmail = asyncHandler(async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        throw new ApiError(400, "Email and verification code are required");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.isVerified) {
        throw new ApiError(400, "User is already verified");
    }

    if (user.verifyCode !== code) {
        throw new ApiError(400, "Invalid verification code");
    }

    if (user.verifyCodeExpiry < new Date()) {
        throw new ApiError(400, "Verification code has expired");
    }

    user.isVerified = true;
    user.verifyCode = undefined;
    user.verifyCodeExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, "Email verified successfully. You can now login."));
});

const resendVerificationCode = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.isVerified) {
        throw new ApiError(400, "User is already verified");
    }

    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verifyCode = verifyCode;
    user.verifyCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Send email in the background to prevent blocking
    sendVerificationEmail(email, verifyCode).catch((err) => {
        console.log("Failed to resend verification email:", err.message);
    });

    return res.status(200).json(new ApiResponse(200, {}, "Verification code resent successfully"));
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    const frontendUrl = process.env.CORS_ORIGIN || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    // Send email in the background to prevent blocking
    sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
        console.log("Failed to send reset email:", err.message);
    });

    return res.status(200).json(new ApiResponse(200, {}, "Password reset link sent to email"));
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token || !newPassword) {
        throw new ApiError(400, "Token and new password are required");
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(400, "Token is invalid or expired");
    }

    user.password = newPassword;
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;
    
    // Allow the pre-save hook to hash the new password
    await user.save();

    return res.status(200).json(new ApiResponse(200, {}, "Password reset successfully"));
});


export {registerUser,loginUser,refreshAccessToken,logoutUser,changeCurrentPassword,getCurrentUser,updateProfileDetails,updateUserAvatar,updateUserCoverImage,getUserChannelProfile,getWatchHistory, verifyEmail, resendVerificationCode, forgotPassword, resetPassword}