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

    if (!options.secretKey) {
        throw new Error("secretKey must be supplied");
    }

    var data = {
        secretKey     : options.secretKey,
        algorithms    : ['RS256','HS256'],
        model         : options.model      || 'User',
        identifier    : options.identifier || 'email',
        password      : options.password   || options.secretKey
    };

    var checkJwt = jwt({
        algorithms    : data.algorithms,
        secret        : data.secretKey
    });

    var mapUser = function(req,res,next) {
        var sub              = req.user.sub.split('|');
        req.user.email       = req.user.sub+'@loopback.'+sub[0]+'.com';

        getUser(req)
        .then(getAccessTokenLength)
        .then(function(data){

          var action;
          if(data.count>0){
            action= getOneToken;
          }else if(data.count===0){
            action = loginUser;
          }else{
            action =createUser;
          }

          action(req)
            .then(function(token) {
                req.accessToken = token;
                console.log(token);
                next();
            })
            .catch(function(err) {
                next(err);
            });
        })
        .catch(function(err){
          next(err);
        });
      };

    function getUser( req){
      return new Promise(function(resolve, reject){
        app.models[data.model].findOne({
            where      : {email: req.user.email},
            include    : ['accessTokens']
        }, function (err, user) {
          if(err) return reject(err);
          resolve(user);
        });
      });
    }

    function getAccessTokenLength(user){
      return new Promise(function(resolve, reject){
        if(!user) return resolve({'user':null, 'count':-1});
        user.accessTokens.count(function  (err, count){
          if(err) return reject(err);
          resolve({'user':user, 'count': count});
        });
      });
    }

    function getOneToken(req){
      return new Promise(function(resolve, reject){
        getUser(req).then(function(user){
          if(!user) return reject(new Error('no user present'));
          user.accessTokens.findOne({}, function(err, token){
            if(err) return reject(err);
            resolve(token);
          });

        })
        .catch(function(err){
          reject(err);
        });
      });
    }


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
                                    console.log(token);
                                      resolve(token);
                                  })
                                  .catch(function(err) {
                                    console.log(err);

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
