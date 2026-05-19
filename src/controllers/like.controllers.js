import {User} from "../models/user.models.js"
import mongoose from "mongoose"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Like} from "../models/like.models.js"

const toggleVideoLike=asyncHandler(async(req,res)=>{
    const {videoId}=req.params
    const userId=req.user?._id

    if(!videoId){
        throw new ApiError(400,"Video not available")
    }

    if(!userId){
        throw new ApiError(400,"User not authorized")
    }

    const existingLike=await Like.findOne({
        video:videoId,
        likedBy:userId
    })

    if(existingLike){
        await Like.findByIdAndDelete(existingLike._id)

        return res.status(200).json(new ApiResponse(200,{isLiked:false},"Like status changed"))
    }

    await Like.create({
            video: videoId,
            likedBy: userId
        });

    return res.status(200).json(new ApiResponse(200,{isLiked:true},"Like status changed"))

})

const toggleCommentLike=asyncHandler(async(req,res)=>{
    const {commentId}=req.params
    const userId=req.user?._id

    if(!commentId){
        throw new ApiError(400,"comment not available")
    }

    if(!userId){
        throw new ApiError(400,"User not authorized")
    }

    const existingLike=await Like.findOne({
        comment:commentId,
        likedBy:userId
    })

    if(existingLike){
        await Like.findByIdAndDelete(existingLike._id)

        return res.status(200).json(new ApiResponse(200,{isLiked:false},"like status changed"))
    }

    await Like.create({
            comment: commentId,
            likedBy: userId
        });

    return res.status(200).json(new ApiResponse(200,{isLiked:true},"Like status changed"))
})

const toggleTweetLike=asyncHandler(async(req,res)=>{
    const {tweetId}=req.params
    const userId=req.user?._id

    if(!tweetId){
        throw new ApiError(400,"tweet not available")
    }

    if(!userId){
        throw new ApiError(400,"User not authorized")
    }

    const existingLike=await Like.findOne({
        tweet:tweetId,
        likedBy:userId
    })

    if(existingLike){
        await Like.findByIdAndDelete(existingLike._id)

        return res.status(200).json(new ApiResponse(200,{isLiked:false},"like status changed"))
    }

    await Like.create({
            tweet: tweetId,
            likedBy: userId
        });

    return res.status(200).json(new ApiResponse(200,{isLiked:true},"Like status changed"))

})

const getLikedVideos=asyncHandler(async(req,res)=>{
    const userId=req.user?._id
    const {page=1,limit=10}=req.query

    const likedVideos= Like.aggregate([
        {
            $match:{
                likedBy:new mongoose.Types.ObjectId(userId),
                video:{$exists:true}
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"video",
                foreignField:"_id",
                as:"videoDetails",
                pipeline:[{
                    $lookup:{
                        from:"users",
                        localField:"owner",
                        foreignField:"_id",
                        as:"ownerDetails",
                        pipeline:[{
                            $project:{
                                fullname:1,
                                username:1,
                                avatar:1
                            }
                        }]
                    }
                },
                {
                    $unwind:"$ownerDetails"
                },
                {
                    $project:{
                        videoFile: 1,
                        thumbnail: 1,
                        title: 1,
                        duration: 1,
                        views: 1,
                        description: 1,
                        ownerDetails: 1
                    }
                }]
            }
        },
        {
            $unwind:"$videoDetails"
        },
        {
            $sort:{
                createdAt:-1
            }
        }
    ])

    const options={
        page:parseInt(page,10),
        limit:parseInt(limit,10)
    }

    const allLikedVideos=await Like.aggregatePaginate(likedVideos,options)

    return res.status(200).json(new ApiResponse(200,allLikedVideos,"All Liked Videos fetched"))

})

export {getLikedVideos,toggleCommentLike,toggleTweetLike,toggleVideoLike}
