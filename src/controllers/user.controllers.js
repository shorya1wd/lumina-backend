import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import { uploadOnCloudinary ,deleteFromCloudinary,extractPublicId} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
import { WatchHistory } from "../models/watchHistory.models.js";

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
        throw new ApiError(409,"User already registered")
    }

    const avatarLocalPath=req.files?.avatar?.[0]?.path
    const coverImageLocalPath=req.files?.coverImage?.[0]?.path

    let avatarUrl=undefined
    let coverImageUrl=undefined
    let avatar
    let coverImage

    if(avatarLocalPath){
        avatar=await uploadOnCloudinary(avatarLocalPath)
        if(avatar){
            avatarUrl=avatar.url
        }
    }
    if(coverImageLocalPath){
        coverImage=await uploadOnCloudinary(coverImageLocalPath)
        if(coverImage){
            coverImageUrl=coverImage.url
        }
    }
    
    try {
        const user=await User.create({
            fullname,
            username,
            email,
            password,
            avatar:avatarUrl,
            coverImage:coverImageUrl
        })
        
        const createdUser=await User.findById(user._id).select("-password -refreshToken")
    
        if(!createdUser){
            throw new ApiError(500,"Something went wrong while registering user")
        }
    
        return res.status(201).json(new ApiResponse(201,createdUser,"User registered successfully"))
    } catch (error) {
        console.log("User creation failed",error)
        if(avatar){
            await deleteFromCloudinary(avatar.public_id,"image")
        }
        if(coverImage){
            await deleteFromCloudinary(coverImage.public_id,"image")
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

    const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id)

    const loggedInUser=await User.findById(user._id).select("-password -refreshToken")

    if(!loggedInUser){
        throw new ApiError(404,"User not found")
    }
   
    const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
}

    res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
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

        const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
}

        const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id)

        return res.status(200).cookie("accessToken",accessToken,options).cookie("refreshToken",refreshToken,options)
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
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
}

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

    const avatar=await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"image couldnt upload on cloudinary")
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
        await deleteFromCloudinary(publicId,"image")
    }

    return res.status(200).json(new ApiResponse(200,user,"Avatar Updated Successfully"))

})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Image not found")
    }

    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(404,"Image upload on cloudinary failed")
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
        await deleteFromCloudinary(publicId,"image")
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


export {registerUser,loginUser,refreshAccessToken,logoutUser,changeCurrentPassword,getCurrentUser,updateProfileDetails,updateUserAvatar,updateUserCoverImage,getUserChannelProfile,getWatchHistory}