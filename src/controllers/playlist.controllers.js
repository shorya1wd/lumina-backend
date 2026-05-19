import mongoose, { sanitizeFilter } from "mongoose"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Playlist } from "../models/playlist.models.js"


const createPlaylist=(asyncHandler(async(req,res)=>{
    const userId=req.user?._id
    const {name,description,isPrivate}=req.body

    if(!name || name.trim()===""){
        throw new ApiError(400,"Name is required")
    }

    if(!description || description.trim()===""){
        throw new ApiError(400,"Description required")
    }

    const createdPlaylist=await Playlist.create({
        owner:userId,
        name:name,
        description:description,
        isPrivate:isPrivate || false
    })

    return res.status(201).json(new ApiResponse(201,createdPlaylist,"Playlist created Successfully"))

})) 

const addVideoToPlaylist=asyncHandler(async(req,res)=>{
    const userId=req.user._id
    const {playlistId,videoId}=req.params

    if(!playlistId || !videoId){
        throw new ApiError(400,"Video Id and playlistId unavailable")
    }

    const playlist=await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if(playlist.owner.toString()!==userId.toString()){
        throw new ApiError(400,"User not authorized to add video")
    }

    const updatedPlaylist=await Playlist.findByIdAndUpdate(playlistId,
        {
            $addToSet: {
                videos: videoId
            }
        },
        {
            returnDocument: 'after'
        }
    )

    return res.status(200).json(new ApiResponse(200,updatedPlaylist,"Video added Successfully"))
})

const removeVideoFromPlaylist=asyncHandler(async(req,res)=>{
    const userId=req.user._id
    const {playlistId,videoId}=req.params
    
    if(!playlistId || !videoId){
        throw new ApiError(400,"Video Id and playlistId unavailable")
    }

    const playlist=await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if(playlist.owner.toString()!==userId.toString()){
        throw new ApiError(403,"User not authorized to remove video")
    }

    const updatedPlaylist=await Playlist.findByIdAndUpdate(playlistId,
        {
            $pull:{
                videos:videoId
            }
        },
        {
            returnDocument: 'after'
        }
    )

    return res.status(200).json(new ApiResponse(200,updatedPlaylist,"Video deleted Successfully")) 
})


const getPlaylistById=asyncHandler(async(req,res)=>{
    const {playlistId}=req.params
    const {page=1,limit=10}=req.query

    const playlistVideos=Playlist.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
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
                }
                ]
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"videos",
                foreignField:"_id",
                as:"videoDetails",
                pipeline:[{
                    $lookup:{
                        from:"users",
                        localField:"owner",
                        foreignField:"_id",
                        as:"userDetails",
                        pipeline:[{
                            $project:{
                                username:1,
                                avatar:1,
                                fullname:1
                            }
                        }]
                    },
                },
                {
                    $unwind:"$userDetails"
                },
                {
                    $project:{
                        thumbnail:1,
                        videoFile:1,
                        title:1,
                        description:1,
                        duration:1,
                        views:1,
                        userDetails:1
                    }
                }
            ]
            }
        },
        {
            $unwind:"$ownerDetails"
        },
        {
            $unwind:{
            path:"$videoDetails",
            preserveNullAndEmptyArrays:true
            }
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

    const playlistVideosById=await Playlist.aggregatePaginate(playlistVideos,options)

    return res.status(200).json(new ApiResponse(200,playlistVideosById,"Playlist videos fetched successfully"))
})

const getUserPlaylists=asyncHandler(async(req,res)=>{
    const {userId}=req.params
    const loggedInUserId = req.user?._id;

    if (!userId) {
        throw new ApiError(400, "User ID is required");
    }

    const matchCondition = {
        owner: new mongoose.Types.ObjectId(userId)
    }

    if (!loggedInUserId || loggedInUserId.toString() !== userId.toString()) {
        matchCondition.isPrivate = false;
    }

    const userPlaylists=await Playlist.aggregate([
        {
            $match:matchCondition
        },
        {
            $lookup:{
                from:"videos",
                localField:"videos",
                foreignField:"_id",
                as:"videos"
            }
        },
        {
            $addFields:{
                totalVideos:{
                    $size:"$videos"
                },
                totalViews:{
                    $sum:"$videos.views"
                }
            }
        },
        {
            $project:{
                name: 1,
                description: 1,
                totalVideos: 1,
                isPrivate: 1,
                totalViews: 1,
                updatedAt: 1,
                videos:1
            }
        }
    ])

    return res
        .status(200)
        .json(new ApiResponse(200, userPlaylists, "User playlists fetched successfully"));
})

const updatePlaylistDetails=asyncHandler(async(req,res)=>{
    const userId=req.user._id
    const {playlistId}=req.params
    const {name,description,isPrivate} =req.body

    if(!name && !description && isPrivate===undefined){
        throw new ApiError(400,"Either of name,description,isPrivate is required")
    }

    if(!userId){
        throw new ApiError(400,"user not found")
    }

    if(!playlistId){
        throw new ApiError(400,"Playlist not found")
    }

    const playlist=await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(400,"Playlist not found")
    }

    if(playlist.owner.toString()!==userId.toString()){
        throw new ApiError(403,"User not authorized")
    }

    const updateFields={}

    if(name){
        updateFields.name=name
    }
    if(description){
        updateFields.description=description
    }
    if(isPrivate!==undefined){
        updateFields.isPrivate=isPrivate
    }

    const updatedPlaylist=await Playlist.findByIdAndUpdate(playlistId,
        {
            $set:updateFields
        },
        {
            returnDocument: 'after'
        }
    )

    return res
        .status(200)
        .json(new ApiResponse(200, updatedPlaylist, "Playlist updated successfully"));
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const userId = req.user?._id;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (playlist.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You do not have permission to delete this playlist");
    }

    await Playlist.findByIdAndDelete(playlistId);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});


export {deletePlaylist,updatePlaylistDetails,createPlaylist,getUserPlaylists,getPlaylistById,removeVideoFromPlaylist,addVideoToPlaylist}
