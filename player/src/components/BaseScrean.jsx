import { Component } from 'react'
import PropTypes from 'prop-types'

import { reaction } from 'mobx'
import { invokeAll } from '../utils'

class BaseScrean extends Component {
  componentDidMount() {
    this.disposeReactions = invokeAll(
      reaction(
        () => this.props.device.isPlaying,
        this.onPlayPause.bind(this)
      ),
      reaction(
        () => this.props.device.seekTo,
        this.onSeek.bind(this)
      ),
      reaction(
        () => this.props.device.isMuted,
        this.onMute.bind(this)
      ),
      reaction(
        () => this.props.device.volume,
        this.onVolume.bind(this)
      ),
      reaction(
        () => this.props.device.source,
        async (source) => this.onSource(source, this.props.device.currentTime)
      ),
      reaction(
        () => this.props.device.audioTrack,
        async (track) => this.onAudioTrack(track)
      ),
      reaction(
        () => this.props.device.quality,
        async (quality) => this.onQuality(quality)
      )
    )
  }

  onPlayPause(isPlaying) { } // eslint-disable-line
  onSeek(seekTime) { } // eslint-disable-line
  onMute(isMuted) { } // eslint-disable-line
  onVolume(volume) { } // eslint-disable-line
  onSource(source) { } // eslint-disable-line
  onAudioTrack(trackId) { } // eslint-disable-line
  onQuality(quality) { } // eslint-disable-line

  componentWillUnmount() {
    this.disposeReactions()
  }
}

BaseScrean.propTypes = {
  device: PropTypes.object.isRequired,
  onEnded: PropTypes.func
}

export default BaseScrean
