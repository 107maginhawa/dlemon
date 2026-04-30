/**
 * nodemailer shim - noop since email not available in embedded mode.
 */

class Transporter {
  async sendMail(_opts: any) {
    console.warn('[nodemailer] Email not available in embedded mode');
    return { messageId: 'embedded-noop' };
  }
  async verify() { return true; }
  close() {}
}

function createTransport(_config?: any) {
  return new Transporter();
}

function createTestAccount() {
  return Promise.resolve({
    user: 'test@example.com',
    pass: 'test',
    smtp: { host: 'localhost', port: 1025 },
  });
}

function getTestMessageUrl(_info: any) {
  return 'https://example.com/test-email';
}

const nodemailer = {
  createTransport,
  createTestAccount,
  getTestMessageUrl,
};

export default nodemailer;
export { createTransport, createTestAccount, getTestMessageUrl };
