// @vitest-environment jsdom

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('reactflow', () => {
  return {
    __esModule: true,
    default: ({ nodes, onNodeClick }: { nodes: Array<{ id: string }>; onNodeClick?: (event: unknown, node: { id: string }) => void }) => (
      <div data-testid="mock-reactflow">
        {nodes.map((node) => (
          <button key={node.id} onClick={(event) => onNodeClick?.(event, { id: node.id })}>
            {node.id}
          </button>
        ))}
      </div>
    ),
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
  };
});

describe('frontend graph UI', () => {
  it('renders summary and displays file details after node click', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText('repo-summary-panel')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('repo-summary-panel')).toHaveTextContent('layered');

    const targetNode = await screen.findByRole('button', { name: 'src/authController.ts' });
    fireEvent.click(targetNode);

    const detailsPanel = screen.getByLabelText('file-details-panel');
    expect(within(detailsPanel).getByText('src/authController.ts')).toBeInTheDocument();
  });

  it('keeps cluster color assignment deterministic', async () => {
    const { buildClusterColorMap } = await import('./graph');

    const first = buildClusterColorMap([
      { name: 'authentication', nodes: ['a'] },
      { name: 'billing', nodes: ['b'] },
    ]);

    const second = buildClusterColorMap([
      { name: 'billing', nodes: ['b'] },
      { name: 'authentication', nodes: ['a'] },
    ]);

    expect(first.get('authentication')).toBe(second.get('authentication'));
    expect(first.get('billing')).toBe(second.get('billing'));
  });
});
