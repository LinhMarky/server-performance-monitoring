import { HttpError } from './errors.js';

export function studentCode(value) {
  if (typeof value !== 'string' || !/^SV\d{7}$/.test(value)) {
    throw new HttpError(400, 'INVALID_STUDENT_CODE', 'Mã sinh viên phải có dạng SV và 7 chữ số, ví dụ SV0000001.');
  }
  return value;
}

export function pageNumber(value, fallback, max, field) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(number) || number > max) {
    throw new HttpError(400, 'INVALID_PAGINATION', `${field} phải là số nguyên từ 1 đến ${max}.`);
  }
  return number;
}
