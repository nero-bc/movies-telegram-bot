import React, { Component, Fragment } from 'react'
import VideoSeekSlider from './VideoSeekSlider'
import '../video-slider.scss'
import PropTypes from 'prop-types'
import { Paper, IconButton, Slide } from '@material-ui/core'
import {
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    SkipPrevious as PreviousIcon,
    SkipNext as NextIcon,
    List as ListIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    PlaylistPlay as PlaylistPlayIcon,
    Shuffle as ShuffleIcon
} from '@material-ui/icons'
import MobileSoundControl from './MobileSoundControl'
import SoundControl from './SoundControl'
import { isTouchDevice } from '../utils'
import { observer } from 'mobx-react'
import AudioTrackSelector from './AudioTrackSelector'
import VideoQualitySelector from './VideoQualitySelector'

@observer
class MediaControls extends Component {
    render() {
        const {
            onPlaylistToggle,
            onFullScreenToggle,
            fullScreen,
            device,
            onPrev,
            onNext,
        } = this.props

        const {
            currentFileIndex,
            playlist: { files },
            shuffle,
        } = device

        const mobile = isTouchDevice()
        const hasAudioTracks = device.audioTracks.length > 1
        const hasQualities = device.qualities.length > 1
        const disablePrev = shuffle || currentFileIndex == 0
        const disableNext = currentFileIndex >= files.length - 1 && !shuffle

        return (
            <Slide direction="up" in mountOnEnter unmountOnExit>
                <Paper elevation={0} square className="player-controls">
                    <VideoSeekSlider
                        buffered={device.buffered}
                        currentTime={device.currentTime}
                        seekTime={device.seekTime}
                        duration={device.duration}
                        onSeekEnd={(time) => device.seek(time)}
                        onSeekTime={(time) => device.seeking(time)}
                    />
                    <div className="player-controls__panel">
                        <div className="player-controls__panel-section">
                            <IconButton onClick={onPrev} disabled={disablePrev}>
                                <PreviousIcon />
                            </IconButton>
                            {!device.isPlaying &&
                                <IconButton onClick={() => device.resume()}>
                                    <PlayIcon />
                                </IconButton>
                            }
                            {device.isPlaying &&
                                <IconButton onClick={() => device.pause()}>
                                    <PauseIcon />
                                </IconButton>
                            }
                            <IconButton onClick={onNext} disabled={disableNext}>
                                <NextIcon />
                            </IconButton>
                            {files.length > 1 && <Fragment>
                                {shuffle &&
                                    <IconButton onClick={() => device.setShuffle(false)}>
                                        <PlaylistPlayIcon />
                                    </IconButton>
                                }
                                {!shuffle &&
                                    <IconButton onClick={() => device.setShuffle(true)}>
                                        <ShuffleIcon />
                                    </IconButton>
                                }
                            </Fragment>}
                            {mobile && <MobileSoundControl device={device} />}
                            {!mobile && <SoundControl device={device} />}
                            {hasAudioTracks && <AudioTrackSelector device={device} />}
                        </div>
                        <div className="player-controls__panel-section">
                            {hasQualities && <VideoQualitySelector device={device}/>}
                            <IconButton onClick={() => onFullScreenToggle()}>
                                {!fullScreen && <FullscreenIcon />}
                                {fullScreen && <FullscreenExitIcon />}
                            </IconButton>
                            <IconButton onClick={() => onPlaylistToggle()}>
                                <ListIcon />
                            </IconButton>
                        </div>
                    </div>
                </Paper>
            </Slide>
        )
    }
}

MediaControls.propTypes = {
    device: PropTypes.object.isRequired,
    onPlaylistToggle: PropTypes.func.isRequired,
    onFullScreenToggle: PropTypes.func,
    onPrev: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    fullScreen: PropTypes.bool,
}

export default MediaControls