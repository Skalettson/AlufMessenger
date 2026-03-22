"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidUsername = isValidUsername;
exports.isValidPhone = isValidPhone;
exports.isValidEmail = isValidEmail;
exports.isValidDisplayName = isValidDisplayName;
exports.isValidBio = isValidBio;
exports.isValidMessageText = isValidMessageText;
exports.isValidOtp = isValidOtp;
exports.sanitizePhone = sanitizePhone;
exports.sanitizeUsername = sanitizeUsername;
const constants_1 = require("../constants");
function isValidUsername(username) {
    return (username.length >= constants_1.USERNAME_MIN_LENGTH &&
        username.length <= constants_1.USERNAME_MAX_LENGTH &&
        constants_1.USERNAME_REGEX.test(username));
}
function isValidPhone(phone) {
    const cleaned = phone.replace(/[\s\-().]/g, '');
    return /^\+[1-9]\d{6,14}$/.test(cleaned);
}
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
function isValidDisplayName(name) {
    return name.trim().length > 0 && name.length <= constants_1.DISPLAY_NAME_MAX_LENGTH;
}
function isValidBio(bio) {
    return bio.length <= constants_1.BIO_MAX_LENGTH;
}
function isValidMessageText(text) {
    return text.length > 0 && text.length <= constants_1.MAX_MESSAGE_TEXT_LENGTH;
}
function isValidOtp(code) {
    return new RegExp(`^\\d{${constants_1.OTP_LENGTH}}$`).test(code);
}
function sanitizePhone(phone) {
    return phone.replace(/[\s\-().]/g, '');
}
function sanitizeUsername(username) {
    return username.toLowerCase().trim();
}
//# sourceMappingURL=validation.js.map