import jwt from "jsonwebtoken"
import { User } from "../models/user.models.js"
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"


export const verifyJWT=asyncHandler(async(req, _,next)=>{
    const token=req.cookies.accessToken || req.header("Authorization")?.replace("Bearer ","")

    if(!token){
        throw new ApiError(401,"Unauthorized User")
    }

    try {
        const decodedToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)

        if(!decodedToken){
            throw new ApiError(404,"Access Token invalid")
        }

        const user=await User.findById(decodedToken._id).select("-password -refreshToken")

        if(!user){
            throw new ApiError(401,"User not found")
        }

        req.user=user

        next()

    } catch (error) {
        throw new ApiError(401,`${error?.message} - invalid access token`)
    }
})

export const optionalVerifyJWT = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        
        if (!token) {
            return next(); 
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken._id).select("-password -refreshToken");

        if (user) {
            req.user = user;
        }
        
        next();
    } catch (error) {
        next(); 
    }
};
