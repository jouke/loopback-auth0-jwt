/** The MIT License (MIT)
 * Copyright (c) 2016 Jouke Visser (jouke@studio-mv.nl), Studio (M/V)*
 * Copyright (c) 2016 Julian Lyndon-Smith (julian@whogloo.io), whoGloo inc
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

module.exports = function(app,options) {
    'use strict';
    var jwt = require('express-jwt');
    var jwks = require('jwks-rsa');

    if (!options.audienceAttr) {
        throw new Error("audienceAttr must be supplied");
    }

    if (!options.auth0Domain) {
        throw new Error("auth0Domain must be supplied");
    }

    var data = {
        audienceAttr: options.audienceAttr,
        auth0Domain: options.auth0Domain,
        secretKey: jwks.expressJwtSecret({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5,
            // YOUR-AUTH0-DOMAIN name e.g https://prosper.auth0.com
            jwksUri: options.auth0Domain + ".well-known/jwks.json"
        }),
        algorithms: ['RS256','HS256'],
        model: options.model      || 'User',
        identifier: options.identifier || 'sub'
    };

    var checkJwt = jwt({
        secret: data.secretKey,
        // These are identifier created on Auth0 API
        audience: data.audienceAttr,
        issuer: data.auth0Domain,
        algorithms: ['RS256','HS256'],
    });

    var mapUser = function(req,res,next) {
        app.models[data.model].findOne({
            where: {
                username: req.user[data.identifier]
            }
        }, function (err, user) {
            if (err) {
                return next(err);
            }
            // IF user exist try to find the latest access token (not the one Auth0)
            // or create a new one
            // Create user account if it's first time he login
            if (user) {
                loginUser(user, req).then(token => {
                    req.accessToken = token;
                    next();
                });
            } else {
                createUser(req).then(token => {
                    req.accessToken = token;
                    next();
                });
            }
        });
    };

    function loginUser(user, req) {
        return new Promise(function(resolve,reject) {
            var now = Math.round(Date.now().valueOf()/1000);
            var ttl = req.user.exp - now;

            user.accessTokens.findOne({}, function(err, accessToken) {
                if (err) {
                    reject(err);
                }

                if(accessToken) {
                    resolve(accessToken);
                } else {
                    app.models[data.model].login({
                        username: req.user[data.identifier],
                        password: req.user[data.identifier],
                        ttl: ttl,
                    }).then(function(token) {
                        resolve(token);
                    })
                    .catch(function(err) {
                        reject(err);
                    });
                }
            })
            
        });
    }

    function createUser(req) {
        return new Promise(function(resolve,reject) {
            app.models[data.model].create({
                username: req.user[data.identifier],
                password: req.user[data.identifier]
            }).then(function() {
                return loginUser(req).then(function(token) {
                    resolve(token);
                });
            }).catch(function(err) {
                reject(err);
            });
        });
    }

    function logout(req, res) {
        app.models[data.model].logout(req.accessToken.id, function(err) {
            res.send(err);
        });
    }

    var authenticated = [checkJwt,mapUser];

    return {
        authenticated: authenticated,
        logout: logout
    };
};
