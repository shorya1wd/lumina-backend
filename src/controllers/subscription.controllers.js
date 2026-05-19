import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import {Subscription} from "../models/subscription.models.js"
import { Video } from "../models/video.models.js";

const toggleSubscription=asyncHandler(async(req,res)=>{
    const {channelId}=req.params
    const user=req.user._id

    if(!user){
        throw new ApiError(400,"User not logged in")
    }

    if(!channelId){
        throw new ApiError(400,"Channel id unavailable")
    }

    const existingSubscription=await Subscription.findOne({
        channel:channelId,
        subscriber:user
    })

    if(existingSubscription){
        const deletedSubscription=await Subscription.findByIdAndDelete(existingSubscription._id)

        return res.status(200).json(new ApiResponse(200,deletedSubscription,"Unsubscribed successfully"))
    }

    const createdSubscription=await Subscription.create({
        channel:channelId,
        subscriber:user
    })

    return res.status(200).json(new ApiResponse(200,createdSubscription,"Subscribed successfully"))
    
  
})


const getUserChannelSubscribers=asyncHandler(async(req,res)=>{
    const {channelId} = req.params

    const channelSubscribers=await Subscription.aggregate([
        {
            $match:{
                channel:new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"subscriber",
                foreignField:"_id",
                as:"subscribers",
                pipeline:[
                {
                    $project:{
                        fullname:1,
                        username:1,
                        avatar:1,
                    }
                }
            ]
            }
        },
        {
            $unwind:"$subscribers"
        }
    ])

    return res.status(200).json(new ApiResponse(200,channelSubscribers,"channel subscribers fetched"))

})

const getSubscribedChannels=asyncHandler(async(req,res)=>{
    const user=req.user?._id

    if(!user){
        throw new ApiError(400,"User not logged in")
    }

    const channelsSubscribed=await Subscription.aggregate([
        {
            $match:{
                subscriber:new mongoose.Types.ObjectId(user)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"channel",
                foreignField:"_id",
                as:"channels",
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
            $unwind:"$channels"
        }
    ])

    return res.status(200).json(new ApiResponse(200,channelsSubscribed,"Channels subscribed fetched successfully"))

})

export {toggleSubscription,getUserChannelSubscribers,getSubscribedChannels}