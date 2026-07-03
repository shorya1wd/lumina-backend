import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT, optionalVerifyJWT } from "../middlewares/auth.middleware.js";
import { uploadVideo, togglePublishStatus, updateVideoDetails, updateThumbnail, deleteVideo, videoViewCount, getVideoById, getAllVideos, getUserChannelVideos } from "../controllers/video.controllers.js"
import { Router } from "express";

const router = Router()

//unsecured routes

router.route("/view/:videoId").patch(optionalVerifyJWT, videoViewCount)

router.route("/:videoId").get(optionalVerifyJWT, getVideoById)

router.route("/").get(getAllVideos)

router.route("/u/:username").get(optionalVerifyJWT, getUserChannelVideos)

//secured routes

router.use(verifyJWT)

router.route("/").post(upload.fields([{ name: "videoFile", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]), uploadVideo)

router.route("/publish-status/:videoId").patch(togglePublishStatus)

router.route("/thumbnail/:videoId").patch(upload.single("thumbnail"), updateThumbnail)

router.route("/:videoId").delete(deleteVideo).patch(updateVideoDetails)

export default router
