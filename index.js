const BadRequestError = require('bad-request-error');
const qs = require('querystring');
const v8n = require('v8n');

class RequestValidator {
    constructor(contentType, maxBodySize = 1e6) { // 1e6 ± 1MB
        this._maxBodySize = maxBodySize;

        if (contentType === 'application/x-www-form-urlencoded' || contentType === 'form') {
            this._contentType = 'application/x-www-form-urlencoded';
        }

        else if (contentType === 'application/json' || contentType === 'json') {
            this._contentType = 'application/json';
        }

        else throw new TypeError('contentType must be one of "application/x-www-form-urlencoded" or "form, or "application/json" or "json"');
    }

    /**
     * Make sure post is urlencoded
     * @param { Object } req
     * @return { Promise }
     */
    _validateReqHeaders(req) {
        const { headers } = req;

        if (!headers || !headers['content-type'] || headers['content-type'] !== this._contentType) {
            return Promise.reject(new BadRequestError(`Content-type must be "${this._contentType}"`));
        }

        return Promise.resolve(req);
    }

    /**
     * Make sure body isn't larger than a MB
     * @param { Stream } body
     * @return { Null | BadRequestError } null if everything's fine, Err otherwise
     */
    _validateReqLength(body) {
        if (body.length > this._maxBodySize) return new BadRequestError(`POST content can’t exceed ${this._maxBodySize} bytes`, 413);
        return null;
    }

    /**
     * Parse data from request object and validate its content
     * @param { Object } req
     * @return { Promise }
     */
    _parseReqData(req) {
        let body = '';

        return new Promise((resolve, reject) => {
            req.on('error', err => reject(new Error(err)));

            req.on('data', (data) => {
                body += data;

                const reqTooBigErr = this._validateReqLength(body);
                if (reqTooBigErr) reject(reqTooBigErr);
            });

            req.on('end', () => {
                if (this._contentType === 'application/x-www-form-urlencoded') return resolve(qs.parse(body));

                try {
                    return resolve(JSON.parse(body));
                }

                catch (e) {
                    return reject(e);
                }
            });
        });
    }

    /**
     * Verify that no post param is missing
     * @param { Object } req
     * @param { Array.<String|Object> } paramsList
     * @return { Promise }
     * @return { Promise.resolve<Object> }
     * @return { Promise.reject<BadRequestError> }
     */
    validate(req, paramsList) {
        return this._validateReqHeaders(req)
        .then(this._parseReqData.bind(this))
        .then((post) => {
            const wrongTypeErr = (paramName, paramType) => Promise.reject(new BadRequestError(`${paramName} param must be a ${paramType}`));
            const validatorFnErr = msg => Promise.reject(new BadRequestError(msg));
            const validatorFnErrDefaultMsg = paramName => `${paramName} failed to validate`;

            for (const param of paramsList) { // eslint-disable-line
                let paramName;
                let paramType;
                let paramCoerce;
                let paramOptional;
                let validatorFn;
                let validatorFailMsg;
                let customValidatorFn;

                // define if string or object
                if (v8n().object().test(param)) {
                    const paramKeys = Object.keys(param);

                    if (paramKeys.length === 1) {
                        [paramName] = paramKeys;
                        paramType = param[paramName];
                    }

                    else {
                        paramName = param.name;
                        paramType = param.type;
                        paramCoerce = param.coerce;
                        paramOptional = param.optional;
                        validatorFn = param.validator;
                        validatorFailMsg = param.failMsg;
                        customValidatorFn = param.customValidator;

                        if (!paramName) throw new Error('Parameters object that have more than { paramName: paramType } must have a "name" property');
                    }

                    if (paramType !== 'string' && paramType !== 'object' && paramType !== 'array' && paramType !== 'number' && paramType !== 'integer' && paramType !== 'boolean') {
                        throw new TypeError(`Type "${paramType}" is not supported. Type must be one of: string, object, array, number, integer, boolean`);
                    }
                }

                else {
                    if (param !== 'string' && param !== 'object' && param !== 'array' && param !== 'number' && param !== 'integer' && param !== 'boolean') {
                        throw new TypeError(`Type "${paramType}" is not supported. Type must be one of: string, object, array, number, integer, boolean`);
                    }

                    paramName = param;
                }

                // validate presence
                if (!post[paramName] && paramType !== 'boolean' && !paramOptional) return Promise.reject(new BadRequestError(`Missing ${paramName} param`));

                if (
                    !post[paramName] // value is false (either undefined or of a falsy value)
                    && (
                        (paramType === 'boolean' && typeof post[paramName] !== 'boolean') // type is bool but value ain't bool
                        || ((paramType === 'number' || paramType === 'integer') && post[paramName] !== 0) // or type is number/int but value ain't 0
                    )
                    && !paramOptional
                ) return Promise.reject(new BadRequestError(`Missing ${paramName} param`));
                if (!post[paramName] && paramOptional) continue; // eslint-disable-line

                // coerce if necessary
                if (paramCoerce && paramType === 'string' && v8n().number().test(post[paramName])) post[paramName] = post[paramName].toString();
                else if (paramCoerce && (paramType === 'integer' || paramType === 'number')) post[paramName] = Number(post[paramName]);
                else if (paramCoerce && paramType === 'boolean') post[paramName] = (post[paramName] === 'true' || post[paramName] === true);
                const paramValue = post[paramName];

                // validate type
                if (paramType) {
                    if (paramType === 'string' && !v8n().string().test(paramValue)) return wrongTypeErr(paramName, paramType);
                    if (paramType === 'object' && !v8n().object().test(paramValue)) return wrongTypeErr(paramName, paramType);
                    if (paramType === 'array' && !v8n().array().test(paramValue)) return wrongTypeErr(paramName, paramType);
                    if (paramType === 'number' && !v8n().number().test(paramValue)) return wrongTypeErr(paramName, paramType);
                    if (paramType === 'integer' && !v8n().number().test(paramValue)) return wrongTypeErr(paramName, paramType);
                    if (paramType === 'boolean' && !v8n().boolean().test(paramValue)) return wrongTypeErr(paramName, paramType);
                }

                // custom validation
                if (validatorFn && !validatorFn(v8n()).test(paramValue)) {
                    if (validatorFailMsg) return validatorFnErr(validatorFailMsg);
                    return validatorFnErr(validatorFnErrDefaultMsg(paramName));
                }

                if (customValidatorFn && !customValidatorFn(paramValue)) {
                    if (validatorFailMsg) return validatorFnErr(validatorFailMsg);
                    return validatorFnErr(validatorFnErrDefaultMsg(paramName));
                }
            }

            return Promise.resolve(post);
        });
    }
}

module.exports = RequestValidator;
