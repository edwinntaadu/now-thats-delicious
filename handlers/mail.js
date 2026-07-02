const nodemailer = require("nodemailer");
const pug = require("pug");
//const juice = require("juice").default;
const { convert } = require("html-to-text");

const transport = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const generateHTML = async (filename, options = {}) => {
  const { default: juice } = await import("juice");

  const html = pug.renderFile(
    `${__dirname}/../views/email/${filename}.pug`,
    options,
  );

  return juice(html);
};

exports.send = async (options) => {
  const html = await generateHTML(options.filename, options);
  const text = convert(html);
  const mailOptions = {
    from:
      process.env.MAIL_FROM ||
      `Now That's Delicious <noreply@nowthatsdelicious.com>`,
    to: options.to || options.user.email,
    subject: options.subject,
    html: html,
    text: text,
  };

  return await transport.sendMail(mailOptions);
};
