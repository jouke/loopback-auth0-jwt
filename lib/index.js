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
            jwksUri: options.auth0Domain + "/.well-known/jwks.json"
        }),
        algorithms: ['RS256','HS256'],
        model: options.model      || 'User',
        identifier: options.identifier || 'email',
        password: options.password   || options.secretKey
    };

    var checkJwt = jwt({
        secret: data.secretKey,
        // These are identifier created on Auth0 API
        audience: data.audienceAttr,
        issuer: data.auth0Domain,
        algorithms: ['RS256','HS256'],
    });

    var mapUser = function(req,res,next) {
        var sub              = req.user.sub.split('|');
        req.user.email       = req.user.sub+'@loopback.'+sub[0]+'.com';

        app.models[data.model].findOne({
            where      : {email: req.user.email},
            include    : ['accessTokens']
        }, function (err, user) {
            if (err) {
                return next(err);
            }
            var action;
            if (!user) {
                action = createUser;
            } else if (user.accessTokens().length === 0) {
                action = loginUser;
            } else {
                action = user.accessTokens.findOne;
            }
            action(req)
              .then(function(token) {
                  req.accessToken = token;
                  next();
              })
              .catch(function(err) {
                  next(err);
              });

        });
    };

    function loginUser(req) {
        return new Promise(function(resolve,reject) {
            var now = Math.round(Date.now().valueOf()/1000);
            var ttl = req.user.exp - now;
            app.models[data.model].login({
                email       : req.user[data.identifier],
                password    : data.password.toString(),
                ttl         : ttl,
            })
                                  .then(function(token) {
                                      resolve(token);
                                  })
                                  .catch(function(err) {
                                      reject(err);
                                  });
        });
    }

    function createUser(req) {
        return new Promise(function(resolve,reject) {
            app.models[data.model].create({
                email       : req.user[data.identifier],
                password    : data.password.toString()
            })
                                  .then(function() {
                                      return loginUser(req)
                                        .then(function(token) {
                                            resolve(token);
                                        });
                                  })
                                  .catch(function(err) {
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
