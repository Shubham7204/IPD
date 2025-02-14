import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FramePlaceholder } from './FramePlaceholder';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

export class FrameErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Frame loading error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return <FramePlaceholder />;
        }

        return this.props.children;
    }
} 