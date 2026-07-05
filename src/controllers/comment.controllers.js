import {User} from "../models/user.models.js"
import mongoose from "mongoose"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Comment} from "../models/comment.models.js"


const createComment=asyncHandler(async(req,res)=>{
    const userId=req.user?._id
    const {videoId}=req.params
    const {content}=req.body

    if(!videoId){
        throw new ApiError(400,"Video not found")
    }

    if(!content || content.trim()===""){
        throw new ApiError(400,"comment is required")
    }

    const newComment=await Comment.create({
        owner:userId,
        video:videoId,
        content:content
    })

    return res.status(200).json(new ApiResponse(200,newComment,"Comment created successfully"))

})

const updateComment=asyncHandler(async(req,res)=>{
    const userId=req.user?._id
    const {commentId}=req.params
    const {content}=req.body

    if(!content || content.trim()===""){
        throw new ApiError(400,"Comment content is required");
    }

    const comment=await Comment.findById(commentId)

    if (!comment){
        throw new ApiError(404,"Comment not found");
    }

    if(comment.owner.toString()!==userId.toString()){
        throw new ApiError(403,"User not authorized to update the comment")
    }

    const updatedComment=await Comment.findByIdAndUpdate(commentId,
        {
            $set:{
                content:content
            }
        },
        {
            returnDocument: 'after'
        }
    )

    return res.status(200).json(new ApiResponse(200,updatedComment,"User Comment Updated successfully"))

})

const deleteComment=asyncHandler(async(req,res)=>{
    const userId=req.user?._id
    const {commentId}=req.params

    const comment=await Comment.findById(commentId)

    if (!comment){
        throw new ApiError(404,"Comment not found");
    }

    // Fetch the associated video to check if the user is the video owner
    const video = await mongoose.model("Video").findById(comment.video);

    const isCommentOwner = comment.owner.toString() === userId.toString();
    const isVideoOwner = video && video.owner.toString() === userId.toString();

    if(!isCommentOwner && !isVideoOwner){
        throw new ApiError(403,"User not authorized to delete the comment")
    }

    await Comment.findByIdAndDelete(commentId)

    return res.status(200).json(new ApiResponse(200,{},"Comment deleted successfully"))
})

const getVideoComments=asyncHandler(async(req,res)=>{
    const {videoId}=req.params
    const {page=1,limit=10}=req.query    

    const videoComment=Comment.aggregate([
        {
            $match:{
                video:new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"userDetails",
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
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
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
            $unwind:"$userDetails"
        },
        {
            $sort:{
                "createdAt":-1
            }
        }
    ])

    const options={
        page:parseInt(page,10),
        limit:parseInt(limit,10)
    }

    const videoComments=await Comment.aggregatePaginate(videoComment,options)

    return res.status(200).json(new ApiResponse(200,videoComments,"Video comments fetched successfully"))
})

export {createComment,updateComment,deleteComment,getVideoComments}