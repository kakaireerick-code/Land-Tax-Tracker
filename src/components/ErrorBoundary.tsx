import React from 'react';

interface ErrorBoundaryState {
  error: string | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { error: null };
  }

  componentDidCatch(error: Error) {
    this.setState({ error: error.message });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace' }}>
          <h2>Error:</h2>
          <p>{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
