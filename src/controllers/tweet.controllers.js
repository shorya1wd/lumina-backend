import {User} from "../models/user.models.js"
import mongoose from "mongoose"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Tweet} from "../models/tweet.models.js"

const createTweet=asyncHandler(async(req,res)=>{
    const userId=req.user?._id
    const {content}=req.body

    if(!userId){
        throw new ApiError(400,"User not logged in")
    }

    if(!content || content.trim()===""){
        throw new ApiError(400,"content field required")
    }

    const newTweet=await Tweet.create({
        owner:userId,
        content:content
    })

    res.status(200).json(new ApiResponse(200,newTweet,"new post created successfully"))
})

const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
        throw new ApiError(400, "User not found");
    }

    const tweets = Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "userDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1,
                            coverImage: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet", 
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
            $unwind: "$userDetails"
        },
        {
            $sort: {
                "createdAt": -1
            }
        }
    ]);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const userTweets = await Tweet.aggregatePaginate(tweets, options);

    return res.status(200).json(new ApiResponse(200, userTweets, "user tweets fetched successfully"));
});

const updateTweet=asyncHandler(async(req,res)=>{
    const userId=req.user?._id
    const {content}=req.body
    const {tweetId} = req.params;

    if(!userId){
        throw new ApiError(400,"User not logged in")
    }

    if(!content || content.trim()===""){
        throw new ApiError(400,"content field required")
    }

    const tweet=await Tweet.findById(tweetId)

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if (tweet.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You do not have permission to edit this tweet");
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content: content
            }
        },
        { new: true }
    );

    return res.status(200).json(new ApiResponse(200,updatedTweet,"Tweet updated successfully"))

})

const deleteTweet=asyncHandler(async(req,res)=>{
    const userId=req.user?._id
    const {tweetId} = req.params;

    const tweet=await Tweet.findById(tweetId)

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if (tweet.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You do not have permission to delete this tweet");
    }

    const deletedTweet=await Tweet.findByIdAndDelete(tweetId)

    return res.status(200).json(new ApiResponse(200,{},` tweet deleted with id:${deletedTweet.id}`))
})

export {createTweet,getUserTweets,updateTweet,deleteTweet}