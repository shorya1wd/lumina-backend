import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary,deleteFromCloudinary,extractPublicId} from "../utils/cloudinary.js"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import mongoose from "mongoose"
import {WatchHistory} from "../models/watchHistory.models.js"
import crypto from "crypto"


const uploadVideo=asyncHandler(async(req,res)=>{
    const {title,description}=req.body

    if(!title){
        throw new ApiError(400,"Title is required")
    }

    const videoFileLocalPath=req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath=req.files?.thumbnail?.[0]?.path

    if(!videoFileLocalPath){
        throw new ApiError(400,"Video is required")
    }

    if(!thumbnailLocalPath){
        throw new ApiError(400,"Thumbnail is required")
    }

    const video=await uploadOnCloudinary(videoFileLocalPath)
    const thumbnail=await uploadOnCloudinary(thumbnailLocalPath)

    if(!video || !thumbnail){
        throw new ApiError(400,"Error uploading video and thumbnail on cloudinary")
    }

    const newVideo=await Video.create({
        videoFile:video.url,
        thumbnail:thumbnail.url,
        title:title,
        description:description,
        duration:video.duration,
        isPublished:false,
        owner:req.user._id,
    })

    return res.status(200).json(new ApiResponse(200,newVideo,"Video created Successfully"))
})

const togglePublishStatus=asyncHandler(async(req,res)=>{
    const {videoId}=req.params

    if(!videoId){
        throw new ApiError(400,"Video Id not available")
    }

    const video=await Video.findById(videoId)

    if(!video){
        throw new ApiError(400,"Video couldnt be found")
    }

    if(video.owner.toString()!==req.user._id.toString()){
        throw new ApiError(400,"You are not authorized for publishing the video")
    }

    video.isPublished=!video.isPublished

    await video.save({validateBeforeSave:false})

    return res.status(200).json(new ApiResponse(200,{isPublished:video.isPublished},"Video Publish status changed"))
})


const updateVideoDetails=asyncHandler(async(req,res)=>{
    const {newTitle,newDescription}=req.body
    const {videoId}=req.params

    if(!newTitle && !newDescription){
        throw new ApiError(400,"Title or description needed for changing the details")
    }

    const video=await Video.findById(videoId)
    
    if(!video){
        throw new ApiError(400,"Video not found")
    }
    
    if(video.owner.toString()!==req.user._id.toString()){
        throw new ApiError(400,"You are not authorized for publishing the video")
    }

    if(newTitle){
        video.title=newTitle
    }
    if(newDescription){
        video.description=newDescription
    }
    await video.save({validateBeforeSave:false})

    return res.status(200).json(new ApiResponse(200,video,"Video details updated successfully"))
})

const updateThumbnail=asyncHandler(async(req,res)=>{
    const {videoId}=req.params

    if(!videoId){
        throw new ApiError(400,"video not found")
    }

    const thumbnailLocalPath=req.file?.path

    const video=await Video.findById(videoId)

    if(video.owner.toString()!==req.user._id.toString()){
        throw new ApiError(400,"You are not authorized")
    }

    const oldThumbnailUrl=video.thumbnail

    if(!thumbnailLocalPath){
        throw new ApiError(400,"Thumnail not available")
    }

    const thumbnail=await uploadOnCloudinary(thumbnailLocalPath)

    if(!thumbnail){
        throw new ApiError(400,"Failed to upload new thumbnail on cloudinary")
    }

    video.thumbnail=thumbnail.url
    const updatedVideo=await video.save({validateBeforeSave:false})

    if(oldThumbnailUrl){
        const publicId=await extractPublicId(oldThumbnailUrl)
        await deleteFromCloudinary(publicId,"image")
    }

    return res.status(200).json(new ApiResponse(200,updatedVideo,"Thumbnail updated successfully"))
})

const deleteVideo=asyncHandler(async(req,res)=>{
    const {videoId}=req.params
    
    if(!videoId){
        throw new ApiError(400,"video not found")
    }

    const video =await Video.findById(videoId)

    if(!video){
        throw new ApiError(400,"Video not found")
    }

    if(video.owner.toString()!==req.user._id.toString()){
        throw new ApiError(400,"User not authorized")
    }

    const videoUrl=video.videoFile
    const thumbnailUrl=video.thumbnail

    const deletedVideo=await Video.findByIdAndDelete(videoId)   

    if(videoUrl){
        const publicId=await extractPublicId(videoUrl)
        await deleteFromCloudinary(publicId,"video")
    }
    if(thumbnailUrl){
        const publicId=await extractPublicId(thumbnailUrl)
        await deleteFromCloudinary(publicId,"image")
    }

    return res.status(200).json(new ApiResponse(200,{},`video deleted`))
})


const videoViewCount=asyncHandler(async(req,res)=>{
    const {videoId}=req.params

    if(!videoId){
        throw new ApiError(400,"Video Id not found")
    }

    const userId=req.user?._id
    let guestId=req.cookies?.guest_session_id

    if(!userId && !guestId){
        guestId=crypto.randomUUID()

        const options={
            httpOnly:true,
            secure:process.env.NODE_ENV === "production",
            maxAge:86400*1000
        }
        res.cookie("guest_session_id",guestId,options)
    }

    const query={video:videoId}
    if(userId){
        query.user=userId
    }
    else if(guestId){
        query.guestIdentifier=guestId
    }

    const recentView=await WatchHistory.findOne(query)

    if(recentView){
        return res.status(200).json(
            new ApiResponse(200, {}, "View already recorded in the last 24 hours")
        );
    }



    const updatedVideo=await Video.findByIdAndUpdate(
        videoId,
        {
            $inc:{
                views:1
            }
        },
        {
            returnDocument: 'after'
        }
    )

    await WatchHistory.create(query)

    return res.status(200).json(new ApiResponse(200,{views:updatedVideo.views},"Video view count incremented"))
})

const getVideoById=asyncHandler(async(req,res)=>{

    const {videoId}=req.params
    if(!videoId){
        throw new ApiError(400,"Video Id not found")
    }

    const userId = req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : null;

    const videoDetails=await Video.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"ownerDetails",
                pipeline:[
                    {
                        $lookup:{
                            from:"subscriptions",
                            localField:"_id",
                            foreignField:"channel",
                            as:"subscribers",
                        }
                    },
                    {
                        $addFields: {
                            susbscribersCount: {
                            $size: { $ifNull: ["$subscribers", []] } 
                            },
                            isSubscribed: {
                                $cond: {
                                    if: {
                                    $in: [userId, { $ifNull: ["$subscribers.subscriber", []] }] 
                                    },
                            then: true,
                            else: false
                        }
                    }
                }
            },
                    {
                        $project:{
                            fullname:1,
                            username:1,
                            avatar:1,
                            susbscribersCount:1,
                            isSubscribed:1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                likesCount: { $size: "$likes" },
                isLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : null, "$likes.likedBy"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                likes: 0 
            }
        },
        {
            $unwind:"$ownerDetails"
        }
    ])

    if(!videoDetails?.length){
        throw new ApiError(400,"Video not found")
    }


    return res.status(200).json(new ApiResponse(200,videoDetails[0],"Video fetched by Id"))
})

const getAllVideos=asyncHandler(async(req,res)=>{
    const {page=1,limit=10,query,sortBy,sortType,userId}=req.query

    const matchConditions={
        isPublished:true
    }

    if(userId){
        matchConditions.owner=new mongoose.Types.ObjectId(userId)
    }

    if(query){
        matchConditions.$or=[
            {
                title:{
                    $regex:query,
                    $options:"i"
                }
            },
            {
                description:{
                    $regex:query,
                    $options:"i"
                }
            }
        ]
    }

    const finalSortBy=sortBy || "createdAt"
    const finalSortType=sortType === "asc" ? 1 : -1

    const sortOptions={
        [finalSortBy]:finalSortType
    }

    const allVideos=Video.aggregate([
        {
            $match:matchConditions
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"ownerDetails",
                pipeline:[
                    {
                        $project:{
                            fullname:1,
                            avatar:1,
                            username:1
                        }
                    }
                ]
            }
        },
        {
            $unwind:"$ownerDetails"
        },
        {
            $sort:sortOptions
        }
    ])

    const paginationOptions={
        page:parseInt(page,10),
        limit:parseInt(limit,10)
    }

    const paginatedVideos=await Video.aggregatePaginate(allVideos,paginationOptions)

    return res.status(200).json(new ApiResponse(200,paginatedVideos,"All videos fetched"))
})

const getUserChannelVideos=asyncHandler(async(req,res)=>{

    const { username } = req.params;
    
    
        const channel = await User.findOne({ username });
        if (!channel) return res.status(404).json({ message: "Channel not found" });

        let query = { owner: channel._id };

        const isOwner = req.user && req.user._id.toString() === channel._id.toString();

        if (!isOwner) {
            query.isPublished = true; 
        } 

        const videos = await Video.find(query).sort({ createdAt: -1 });
        
        res.status(200).json(new ApiResponse(200,videos,"User channel videos fetched"));
        

})

export {uploadVideo,togglePublishStatus,updateVideoDetails,updateThumbnail,deleteVideo,videoViewCount,getVideoById,getAllVideos,getUserChannelVideos}