import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999, background: '#FFF0F0',
          color: '#900', padding: 16, fontFamily: 'monospace', fontSize: 13,
          overflow: 'auto', whiteSpace: 'pre-wrap',
        }}>
          <strong>Render error:</strong>{'\n\n'}
          {this.state.error.message}
          {'\n\n'}
          {this.state.error.stack}
        </div>
      )
    }
    return this.props.children
  }
}