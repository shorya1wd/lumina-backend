import { Router } from "express";
import { registerUser,loginUser,logoutUser ,refreshAccessToken,changeCurrentPassword,getCurrentUser,updateProfileDetails,updateUserAvatar,updateUserCoverImage,getUserChannelProfile,getWatchHistory} from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { optionalVerifyJWT, verifyJWT } from "../middlewares/auth.middleware.js";

const router=Router()

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)

router.route("/refresh-token").post(refreshAccessToken)

router.route("/channel/:username").get(optionalVerifyJWT,getUserChannelProfile)

//secured routes

router.use(verifyJWT)

router.route("/logout").post(logoutUser)

router.route("/change-password").post(changeCurrentPassword)

router.route("/current-user").get(getCurrentUser)

router.route("/update-profile").patch(updateProfileDetails)

router.route("/update-avatar").patch(upload.single("avatar"),updateUserAvatar)

router.route("/update-coverimage").patch(upload.single("coverImage"),updateUserCoverImage)

router.route("/watch-history").get(getWatchHistory)

export default router
