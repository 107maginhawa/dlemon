/**
 * ImageUpload component tests
 *
 * Covers: file validation (MIME, size), disabled state, progress bar, onSuccess callback.
 * Uses global.fetch mocking (no mock.module) to avoid contaminating use-imaging-upload hook tests.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClient, makeWrapper as makeWrapperBase } from '@/test-utils';
import { ImageUpload } from '../components/image-upload';

const originalFetch = global.fetch;

function makeWrapper() {
  return makeWrapperBase(freshClient());
}

function makeFile(name = 'xray.jpg', type = 'image/jpeg', sizeBytes = 1024): File {
  const buf = new ArrayBuffer(sizeBytes);
  return new File([buf], name, { type });
}

const DEFAULT_PROPS = {
  patientId: 'pat-1',
  branchId: 'br-1',
};

beforeEach(() => {
  // Default: upload succeeds (POST initiate → PUT to presigned URL)
  global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
    if (method === 'POST' && String(url).includes('/dental/imaging/studies')) {
      return Promise.resolve(new Response(JSON.stringify({
        study: { id: 'study-1' },
        uploadUrl: 'https://s3.example.com/upload',
        uploadMethod: 'PUT',
        fileId: 'file-1',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    if (method === 'PUT') {
      return Promise.resolve(new Response('', { status: 200 }));
    }
    return Promise.resolve(new Response('', { status: 200 }));
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

describe('ImageUpload', () => {
  test('rejects file with unsupported MIME type', () => {
    render(React.createElement(ImageUpload, DEFAULT_PROPS), { wrapper: makeWrapper() });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('doc.pdf', 'application/pdf', 1024);
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/unsupported format/i)).not.toBeNull();
  });

  test('rejects file > 100MB', () => {
    render(React.createElement(ImageUpload, DEFAULT_PROPS), { wrapper: makeWrapper() });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('big.jpg', 'image/jpeg', 101 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/file too large/i)).not.toBeNull();
  });

  test('accepts valid JPEG within size limit', () => {
    render(React.createElement(ImageUpload, DEFAULT_PROPS), { wrapper: makeWrapper() });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('xray.jpg', 'image/jpeg', 5 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.queryByText(/unsupported/i)).toBeNull();
    expect(screen.queryByText(/too large/i)).toBeNull();
  });

  test('P1-9 accepts a DICOM file by application/dicom MIME type', () => {
    render(React.createElement(ImageUpload, DEFAULT_PROPS), { wrapper: makeWrapper() });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('ceph.dcm', 'application/dicom', 1024);
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.queryByText(/unsupported/i)).toBeNull();
  });

  test('P1-9 accepts a .dcm file even when the browser gives no MIME type', () => {
    render(React.createElement(ImageUpload, DEFAULT_PROPS), { wrapper: makeWrapper() });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('ceph.dcm', '', 1024);
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.queryByText(/unsupported/i)).toBeNull();
  });

  test('submit button disabled when no file selected', () => {
    render(React.createElement(ImageUpload, DEFAULT_PROPS), { wrapper: makeWrapper() });
    const btn = screen.getByRole('button', { name: /upload/i });
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  test('shows progress bar (Uploading text) during upload', async () => {
    // Use a never-resolving fetch to freeze upload mid-flight
    global.fetch = mock(() => new Promise(() => {}));

    const user = userEvent.setup();
    render(React.createElement(ImageUpload, DEFAULT_PROPS), { wrapper: makeWrapper() });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('xray.jpg', 'image/jpeg', 1024);
    fireEvent.change(input, { target: { files: [file] } });

    // Start upload without awaiting (it will never complete)
    const btn = screen.getByRole('button', { name: /upload/i });
    void user.click(btn);

    // Wait for "Uploading" text to appear
    await waitFor(() => expect(screen.getByText(/uploading/i)).not.toBeNull());
  });

  test('calls onSuccess with studyId on completion', async () => {
    const user = userEvent.setup();
    const onSuccess = mock(() => {});

    render(
      React.createElement(ImageUpload, { ...DEFAULT_PROPS, onSuccess }),
      { wrapper: makeWrapper() },
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('xray.jpg', 'image/jpeg', 1024);
    fireEvent.change(input, { target: { files: [file] } });

    const btn = screen.getByRole('button', { name: /upload/i });
    await user.click(btn);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('study-1');
    });
  });
});
