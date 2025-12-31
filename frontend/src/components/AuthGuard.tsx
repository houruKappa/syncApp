import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface AuthGuardProps {
    children: React.ReactElement;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const navigate = useNavigate();
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);

    useEffect(() => {
        // Only check if user has token
        if (!isAuthenticated) {
            console.log('No token, redirecting to login');
            navigate('/login', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    // If authenticated, render children
    if (isAuthenticated) {
        return children;
    }

    // Otherwise render nothing (will redirect via useEffect)
    return null;
};

export default AuthGuard;
