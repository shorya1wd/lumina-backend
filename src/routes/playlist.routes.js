import {deletePlaylist,updatePlaylistDetails,createPlaylist,getUserPlaylists,getPlaylistById,removeVideoFromPlaylist,addVideoToPlaylist} from "../controllers/playlist.controllers.js"
import { verifyJWT,optionalVerifyJWT } from "../middlewares/auth.middleware.js";
import { Router } from "express";

const router=Router()

//unsecured routes

router.route("/p/:playlistId").get(getPlaylistById)



router.route("/user/:userId").get(optionalVerifyJWT,getUserPlaylists)

// secured routes

router.use(verifyJWT)

router.route("/").post(createPlaylist)

router.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist)

router.route("/remove/:playlistId/:videoId").patch(removeVideoFromPlaylist)


router.route("/:playlistId").patch(updatePlaylistDetails).delete(deletePlaylist)

export default router