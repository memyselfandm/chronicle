/**
 * SessionBadges Component Tests
 * Tests for color-coded session count badges in header
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { jest } from '@jest/globals';
import { SessionBadges } from '../src/components/layout/SessionBadges';

describe('SessionBadges', () => {
  const defaultProps = {
    activeSessions: 5,
    awaitingSessions: 2
  };

  it('renders active sessions badge correctly', () => {
    render(<SessionBadges {...defaultProps} />);
    
    const activeBadge = screen.getByTestId('session-badge-green');
    expect(activeBadge).toBeInTheDocument();
    expect(activeBadge).toHaveTextContent('5 active');
  });

  it('renders awaiting sessions badge correctly', () => {
    render(<SessionBadges {...defaultProps} />);
    
    const awaitingBadge = screen.getByTestId('session-badge-yellow');
    expect(awaitingBadge).toBeInTheDocument();
    expect(awaitingBadge).toHaveTextContent('2 awaiting');
  });

  it('displays correct tooltips', () => {
    render(<SessionBadges {...defaultProps} />);
    
    const activeBadge = screen.getByTestId('session-badge-green');
    const awaitingBadge = screen.getByTestId('session-badge-yellow');
    
    expect(activeBadge).toHaveAttribute('title', '5 sessions currently running');
    expect(awaitingBadge).toHaveAttribute('title', '2 sessions awaiting user input');
  });

  it('handles zero counts', () => {
    render(<SessionBadges activeSessions={0} awaitingSessions={0} />);
    
    const activeBadge = screen.getByTestId('session-badge-green');
    const awaitingBadge = screen.getByTestId('session-badge-yellow');
    
    expect(activeBadge).toHaveTextContent('0 active');
    expect(awaitingBadge).toHaveTextContent('0 awaiting');
  });

  it('handles large numbers', () => {
    render(<SessionBadges activeSessions={99} awaitingSessions={15} />);
    
    const activeBadge = screen.getByTestId('session-badge-green');
    const awaitingBadge = screen.getByTestId('session-badge-yellow');
    
    expect(activeBadge).toHaveTextContent('99 active');
    expect(awaitingBadge).toHaveTextContent('15 awaiting');
  });

  it('calls onClick handler for active sessions', () => {
    const mockOnClick = jest.fn();
    render(<SessionBadges {...defaultProps} onClick={mockOnClick} />);
    
    const activeBadge = screen.getByTestId('session-badge-green');
    fireEvent.click(activeBadge);
    
    expect(mockOnClick).toHaveBeenCalledWith('active');
  });

  it('calls onClick handler for awaiting sessions', () => {
    const mockOnClick = jest.fn();
    render(<SessionBadges {...defaultProps} onClick={mockOnClick} />);
    
    const awaitingBadge = screen.getByTestId('session-badge-yellow');
    fireEvent.click(awaitingBadge);
    
    expect(mockOnClick).toHaveBeenCalledWith('awaiting');
  });

  it('does not add click handlers when onClick is not provided', () => {
    render(<SessionBadges {...defaultProps} />);
    
    const activeBadge = screen.getByTestId('session-badge-green');
    const awaitingBadge = screen.getByTestId('session-badge-yellow');
    
    // Should not have cursor-pointer class
    expect(activeBadge).not.toHaveClass('cursor-pointer');
    expect(awaitingBadge).not.toHaveClass('cursor-pointer');
  });

  it('adds click styling when onClick is provided', () => {
    const mockOnClick = jest.fn();
    render(<SessionBadges {...defaultProps} onClick={mockOnClick} />);
    
    const activeBadge = screen.getByTestId('session-badge-green');
    const awaitingBadge = screen.getByTestId('session-badge-yellow');
    
    expect(activeBadge).toHaveClass('cursor-pointer');
    expect(awaitingBadge).toHaveClass('cursor-pointer');
  });

  it('applies correct color classes for active sessions', () => {
    render(<SessionBadges {...defaultProps} />);
    
    const activeBadge = screen.getByTestId('session-badge-green');
    const activeDot = activeBadge.querySelector('div');
    const activeText = activeBadge.querySelector('span');
    
    expect(activeDot).toHaveClass('bg-status-active');
    expect(activeText).toHaveClass('text-status-active');
  });

  it('applies correct color classes for awaiting sessions', () => {
    render(<SessionBadges {...defaultProps} />);
    
    const awaitingBadge = screen.getByTestId('session-badge-yellow');
    const awaitingDot = awaitingBadge.querySelector('div');
    const awaitingText = awaitingBadge.querySelector('span');
    
    expect(awaitingDot).toHaveClass('bg-status-awaiting');
    expect(awaitingText).toHaveClass('text-status-awaiting');
  });

  it('applies custom className', () => {
    const customClass = 'custom-badges-class';
    render(<SessionBadges {...defaultProps} className={customClass} />);
    
    const sessionBadges = screen.getByTestId('session-badges');
    expect(sessionBadges).toHaveClass(customClass);
  });

  it('maintains semantic structure', () => {
    render(<SessionBadges {...defaultProps} />);
    
    const sessionBadges = screen.getByTestId('session-badges');
    expect(sessionBadges).toBeInTheDocument();
    
    // Check that both badges are present
    const badges = sessionBadges.querySelectorAll('[data-testid^="session-badge-"]');
    expect(badges).toHaveLength(2);
  });

  it('uses appropriate font styling', () => {
    render(<SessionBadges {...defaultProps} />);
    
    const activeBadge = screen.getByTestId('session-badge-green');
    const awaitingBadge = screen.getByTestId('session-badge-yellow');
    
    // Check for font styling classes
    const activeText = activeBadge.querySelector('span');
    const awaitingText = awaitingBadge.querySelector('span');
    
    expect(activeText).toHaveClass('text-xs');
    expect(activeText).toHaveClass('font-medium');
    expect(awaitingText).toHaveClass('text-xs');
    expect(awaitingText).toHaveClass('font-medium');
  });
});