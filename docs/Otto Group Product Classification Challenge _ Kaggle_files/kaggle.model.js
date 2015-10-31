// Model Objects and Caches
(function ($) {
    with (Kaggle.Model) {
        // Model object for a Kaggle Attributes
        entity("Attribute", {
            mixin: [ RestMixin, AllMixin ],
            meta: {
                name: new Property(),
                dataType: new Property(),
                dataTypeText: new Computed(function () {
                    var text = this.dataType();
                    return this.multiple() ? text + "[]" : text;
                }),
                multiple: new Property(false),
                options: new Property(false),
                constrain: new Property(false),
                optionList: new Collection("AttributeOption"),
                optionCount: new Computed(function () {
                    return this.optionList().length;
                }),
                optionText: new Computed(function () {
                    return Kaggle.Format.inflectIntegerNo(this.optionCount(), "Option", "Options");
                }),
                optionSummary: new Computed(function () {
                    var count = this.optionCount();
                    if (this.constrain()) return "Constrain(" + count + ")";
                    if (this.options()) return "Optional(" + count + ")";
                    return "None";
                }),
                permissions: new Property(false),
                adminRead: new Property(),
                adminWrite: new Property(),
                resourceRead: new Property(),
                resourceWrite: new Property(),
                publicRead: new Property(),
                publicWrite: new Property(),
                documentation: new Property()
            },
            restUrl: function () {
                return Kaggle.Url.Rest.Attributes;
            }
        });

        // Model object for a single Attribute option
        entity("AttributeOption", {
            meta: {
                value: new Property(),
                orderId: new Property(),
                orderValue: new Property()
            }
        });

        // Model object for a Kaggle Attributes
        entity("UserAttribute", {
            mixin: [ UserMixin, RestMixin ],
            meta: {
                attribute: new Reference("Attribute"),
                value: new Property(),
                canonicalValue: new Property(),
                trimmedValue: new Computed(function () {
                    return $.trim(this.canonicalValue());
                }),
                trimmedExists: new Computed(function () {
                    var trimmed = this.trimmedValue();
                    return trimmed.length ? true : false;
                })
            },
            restUrl: function () {
                return Kaggle.Url.Rest.UserAttributes;
            },
            restPostData: function () {
                var data = this.formData();
                if (this.profile.peek()) {
                    data.userId = this.profile.peek().id;
                }
                if (this.attribute.peek()) {
                    data.attributeId = this.attribute.peek().id;
                }
                return data;
            }
        });
        
        // Static Website Objects
        entity("Site", {
            meta: {
                shortName: new Property(),
                longName: new Property(),
                hostName: new Property(),
                isOnKaggleDomain: new Computed(function() {
                    var host = this.hostName();
                    var like = /\.kaggle\.com$/;
                    return host && like.test(host);
                })
            }
        });
        
        // Model cache for Kaggle Sites
        Kaggle.Model.SiteCache = {
            // Prefill the cache with all possible sites
            init: function () {
                for (var id in Kaggle.Constant.siteTable) {
                    var row = Kaggle.Constant.siteTable[id];
                    this[row[0]] = new Kaggle.Model.Site({
                        id: row[0],
                        shortName: row[1],
                        longName: row[2],
                        hostName: row[3]
                    });
                }
            },
            
            // Methods for consistency with other caches
            get: function (id) {
                return this[id];
            },

            load: function (id) {
                return this[id];
            },
            
            main: function() {
                return this.load(1);
            }
        };
        Kaggle.Model.SiteCache.init();

        // Model object for site statistics
        entity("SiteStatistics", {
            mixin: [ RestMixin ],
            meta: {
                players: new Property(),
                playersText: new Property(),
                submissions: new Property(),
                submissionsText: new Property()
            },
            restUrl: function () {
                return Kaggle.Url.Rest.SiteStatistics;
            }
        });

        // Model object for countries (for use in country widgets)
        entity("Country", {
            mixin: [ RestMixin, AllMixin ],
            meta: {
                alpha2: new Property(),
                name: new Property()
            },
            restUrl: function () {
                return Kaggle.Url.Rest.Countries;
            }
        });

        // Model object for languages
        entity("Language", {
            mixin: [RestMixin, AllMixin],
            meta: {
                id: new Property(),
                name: new Property()
            },
            restUrl: function () {
                return Kaggle.Url.Rest.Languages;
            }
        });
        
        // Model object for timezones (for use in timezone widget)
        entity("TimeZone", {
            mixin: [ RestMixin, AllMixin ],
            meta: {
                name: new Property(),
                alias: new Property(),
                continent: new Property(),
                region: new Property(),
                offsetMinutes: new Property()
            },
            restUrl: function () {
                return Kaggle.Url.Rest.TimeZones;
            }
        });

        // Model object for timezone continents (for use in timezone widgets)
        entity("TimeZoneContinent", {
            mixin: [RestMixin, AllMixin],
            meta: {
                name: new Property()
            },
            restUrl: function () {
                return Kaggle.Url.Rest.TimeZoneContinents;
            }
        });
        
        // Model object for a Kaggle Competition
        entity("Competition", {
            mixin: [ SiteMixin, RestMixin ],
            meta: {
                name: new Property(),
                title: new Property(),
                deadline: new Property(),
                isActive: new Property(false),
                isCompleted: new Property(false),
                isFinal: new Property(false),
                isPublic: new Property(false),
                isPrivate: new Property(false),
                isMasters: new Property(false),
                isRestricted: new Computed(function () {
                    return this.isPrivate() || this.isMasters();
                })
            },
            restUrl: function () {
                return Kaggle.Url.Rest.Competitions;
            },
            url: function () {
                return Kaggle.Url.competitionUrl(this);
            },
            logo: function () {
                return Kaggle.Url.competitionLogo(this);
            },
            thumbnail: function () {
                return Kaggle.Url.competitionThumbnail(this);
            }
        });

        // Model object for a single team in a competition
        entity("Team", {
            mixin: [ RestMixin ],
            meta: {
                name: new Property(),
                slug: new Property("-"),
                url: new Computed(function () {
                   return Kaggle.Url.teamPath(this);
                }),
                competition: new Reference("Competition"),
                rank: new Property(),
                rankText: new Property(),
                teamLeader: new Reference("Profile"),
                isAnonymous: new Property(),
                isInterestedInHostContact: new Property(),
                members: new Collection("Profile"),
                activeInvites: new Collection("TeamInvite"),
                rejectedInvites: new Collection("TeamInvite")
            },
            makeTeamLeaderUrl: function(user) {
                return Kaggle.Url.teamMakeLeader(this, user);
            },
            saveTeamSettingsUrl: function() {
                return Kaggle.Url.teamSaveSettings(this);
            },
            inviteUrl: function() {
                return Kaggle.Url.teamInvite(this);
            },
            uninviteUrl: function() {
                return Kaggle.Url.teamUninvite(this);
            }
        });

        // Model object for an invitation to join a team in a competition
        entity("TeamInvite", {            
            meta: {
                email: new Property(),
                code: new Property(),
                allowMerger: new Property(),
                rejectedDate: new Property()
            }
        });
        
        // Model object for a team's result in a competition
        entity("TeamResult", {
            meta: {
                name: new Property(),
                slug: new Property("-"),
                url: new Computed(function () {
                   return Kaggle.Url.teamPath(this);
                }),
                competition: new Reference("Competition"),
                rank: new Property(),
                rankText: new Property(),
                teamCount: new Property(),
                percentile: new Property(),
                prizeRank: new Property(),
                isPrizeWinner: new Property(),
                isHeadline: new Property(),
                submissionCount: new Property(),
                submissionText: new Computed(function () {
                    return Kaggle.Format.inflectIntegerNo(this.submissionCount(), "entry", "entries");
                }),
                rankSummary: new Computed(function () {
                    var text = this.rankText();
                    if (!text) return null;
                    if (this.isHeadline()) return text;
                    var percentile = this.percentile();
                    if (percentile <= 0.1) return "Top 10%";
                    if (percentile <= 0.25) return "Top 25%";
                    return null;
                }),
                css: new Computed(function () {
                    var text = this.rankText();
                    if (!text) return null;
                    if (!this.rank()) return null;
                    if (this.isPrizeWinner()) return "winner";
                    var percentile = this.percentile();
                    if (percentile <= 0.1) return "top-10";
                    if (percentile <= 0.25) return "top-25";
                    return null;
                })
            }
        });
        
        // Model object for a content Post
        entity("Post", {
            mixin: [ UserMixin ],
            meta: {
                title: new Property(),
                mimeType: new Property(),
                content: new Property(),
                created: new Property()
            }
        });
        
        // Model object for a Kaggle profile
        // /knockout/profiles/123/results
        entity("Profile", {
            mixin: [ RestMixin ],
            meta: {
                name: new Property(),
                slug: new Property("-"),
                tier: new Property(),
                tierName: new Computed(function () {
                    var tier = this.tier();
                    if (tier >= 10) {
                        return "master";
                    } else if (tier >= 4) {
                        return "kaggler";
                    } else {
                        return "novice";
                    }
                }),
                gravatar: new Property(),
                registered: new Property(),
                points: new Property(),
                pointsText: new Property(),
                ranking: new Property(),
                rankingText: new Property(),
                highestRanking: new Property(),
                highestRankingText: new Property(),
                url: new Property(),
                canSendUserMessages: new Property(),
                isSiteAdmin: new Property(),
                isSelf: new Computed(function() {
                    return Kaggle.Current.userId && Kaggle.Current.userId == this.id;
                }),
                attributes: new Collection("UserAttribute", { Rest: "attributes" }),
                summary: new Reference("ProfileSummary", { Rest: "summary" }),
                results: new Collection("TeamResult", { Rest: "results/headline" }),
                resultsText: new Computed(function () {
                    if (!this.results.loaded()) return null;
                    return Kaggle.Format.inflectIntegerNo(this.results.length, "competition", "competitions");
                }),
                fullResults: new Collection("TeamResult", { Rest: "results" }),
                achievements: new Collection("ProfileAchievement", { Rest: "achievements" }),
                forumSummary: new Reference("ProfileForumSummary", { Rest: "forum-summary" }),
                forumActivity: new Collection("ForumMessage", { Rest: "forum-activity" }),
                notifications: new Reference("ProfileNotifications", { Rest: "notifications" }),
                resultsUrl: new Computed(function () {
                    return Kaggle.Url.profileResults(this);
                }),
                scriptsUrl: new Computed(function () {
                    return Kaggle.Url.profileScripts(this);
                }),
                forumUrl: new Computed(function () {
                    return Kaggle.Url.profileForum(this);
                }),
                accountUrl: new Computed(function () {
                    return Kaggle.Url.profileAccount(this);
                }),
                messageUrl: new Computed(function () {
                    return Kaggle.Url.profileMessage(this);
                }),
                activityUrl: new Computed(function () {
                    return Kaggle.Url.profileActivity(this);
                }),
                hunnerdbuxUrl: new Computed(function() {
                    return Kaggle.Url.profileHunnerdbux(this);
                }),
                editUrl: new Computed(function () {
                    return Kaggle.Url.profileEdit(this);
                })
            },
            gravatarUrl: function (size) {
                return Kaggle.Url.gravatarUrl(this.gravatar(), size);
            },
            restUrl: function () {
                return Kaggle.Url.Rest.Profiles;
            },
            restDisplayUrl: function () {
                return Kaggle.Url.profileRestDisplay(this);
            },
            restLegalUrl: function () {
                return Kaggle.Url.profileRestLegal(this);
            },
            restEmailUrl: function () {
                return Kaggle.Url.profileRestEmail(this);
            },
            restBirthdayUrl: function () {
                return Kaggle.Url.profileRestBirthday(this);
            },
            gotoUrl: function () {
                window.location = this.url();
            }
        });

        entity("ProfileSummary", {
            meta: {
                age: new Property(),
                city: new Property(),
                region: new Property(),
                country: new Property(),
                tagline: new Property(),
                taglineText: new Computed(function () {
                    var tagline = this.tagline();
                    // TODO: Constrain to 170 characters
                    return tagline ? tagline : null;
                }),
                bio: new Property(),
                location: new Computed(function () {
                    var city = this.city();
                    var region = this.region();
                    var country = this.country();
                    if (city || region || country) {
                        var array = [];
                        if (city) array.push(city);
                        if (region) array.push(region);
                        if (country) array.push(country);
                        return array.join(", ");
                    }
                    return "";
                }),
                github: new Property(),
                githubUrl: new Computed(function () {
                    var github = this.github();
                    return github ? "http://github.com/" + github : null;
                }),
                twitter: new Property(),
                twitterUrl: new Computed(function () {
                    var twitter = this.twitter();
                    return twitter ? "http://twitter.com/" + twitter : null;
                }),
                linkedinUrl: new Property(),
                websiteUrl: new Property(),
                skills: new List(),
                tools: new List(),
                techniques: new List()
            }
        });

        // Model object for a Kaggle achievement
        entity("ProfileAchievement", {
            meta: {
                name: new Property(),
                count: new Property(),
                label: new Property(),
                total: new Property(),
                multiple: new Computed(function () {
                    var count = this.count();
                    return count && count > 1;
                }),
                css: new Computed(function () {
                    return Kaggle.Format.text2css(this.name());
                })
            }
        });

        // Model object for an email subscription or notification
        entity("ProfileNotifications", {
            meta: {
                subscribeToKaggleNewsletter: new Property(false),
                blockAllUserContactEmails: new Property(false)
            }
        });
        
        // Profile forum statistics
        entity("ProfileForumSummary", {
            meta: {
                totalPosts: new Property(),
                votesGiven: new Property(),
                votesReceived: new Property(),
                mostActiveForum: new Reference("Forum", { Rest: true }),
                mostActiveCount: new Property()
            }
        });
        
        // Model object for a Forum
        entity("Forum", {
            mixin: [ RestMixin ],
            meta: {
                name: new Property(),
                isPrivate: new Property(),
                isLimited: new Property(),
                competition: new Reference("Competition"),
                topicCount: new Property(),
                messageCount: new Property(),
                redirectUrl: new Computed(function () {
                    return Kaggle.Url.forumRedirectUrl(this);
                })
            },
            restUrl: function () {
                return Kaggle.Url.Rest.Forums;
            }
        });
        
        // Model object for a Forum Topic (thread)
        entity("ForumTopic", {
            meta: {
                name: new Property(),
                forum: new Reference("Forum", { Rest: true }),
                redirectUrl: new Computed(function () {
                    return Kaggle.Url.forumTopicRedirectUrl(this);
                })
            }
        });
        
        // Model object for a single Forum Message
        entity("ForumMessage", {
            mixin: [ UserMixin ],
            meta: {
                messageHtml: new Property(),
                forumTopic: new Reference("ForumTopic"),
                redirectUrl: new Computed(function () {
                    return Kaggle.Url.forumMessageRedirectUrl(this);
                })
            }
        });
        
        // Model object for a user message
        entity("UserMessage", {
            mixin: [ RestMixin ],
            meta: {
                toUserId: new Property(),
                toProfile: new Computed(function () {
                    return Kaggle.Model.ProfileCache.load(this.toUserId());
                }),
                fromUserId: new Property(),
                fromProfile: new Computed(function () {
                    return Kaggle.Model.ProfileCache.load(this.fromUserId());
                }),
                created: new Property(),
                sent: new Property(),
                abuseFlag: new Property(),
                postId: new Property(),
                post: new Reference("Post")
            }
        });

        // Model object for a competition Prospector
        entity("Prospector", {
            mixin: [ RestMixin ],
            meta: {
                url: new Property(),
                competition: new Reference("Competition"),
                orderBy: new Property("updated"),
                dashboardTerm: new Property(),
                hasSlideshows: new Property(),
                hasComments: new Property(true),
                hasAwards: new Property(),
                hasVotes: new Property(),
                canShowVotes: new Property(),
                canCreate: new Property(),
                canComment: new Property(),
                canVote: new Property(),
                post: new Reference("Post"),
                title: new Computed(function () {
                    var post = this.post();
                    if (post && post.title().length) {
                        return post.title();
                    } else {
                        return "Visualization";
                    }
                }),
                content: new Computed(function () {
                    var post = this.post();
                    if (post && post.content().length) {
                        return post.content();
                    } else {
                        return "";
                    }
                }),
                prospectCount: new Property(),
                prospectList: new Collection("Prospect", { Rest: "prospects" }),
                prospectOrder: new Computed(function () {
                    var orderBy = this.orderBy() || "newest";
                    var prospectList = this.prospectList();
                    
                    // Handle the trivial case (some functions need at least one element)
                    if (!prospectList.length) {
                        return prospectList;
                    }
                    
                    // Implement the various sorting functions
                    if (orderBy == "voteCount") {
                        return prospectList.sort(function (a, b) {
                            return (b.voteCount() - a.voteCount())
                                || (b.created() - a.created());
                        });
                    }
                    if (orderBy == "oldest") {
                        return prospectList.sort(function (a, b) {
                            return (a.created() - b.created());
                        });
                    }
                    if (orderBy == "updated") {
                        return prospectList.sort(function (a, b) {
                            var aDate = a.updated() || a.created();
                            var bDate = b.updated() || b.created();
                            return bDate - aDate;
                        });
                    }

                    // Newest is also the fallback default
                    // if (orderBy == "newest") {
                        return prospectList.sort(function (a, b) {
                            return (b.created() - a.created());
                        });
                    // }
                })
            },
            restGetUrl: function () {
                return Kaggle.Url.fetchProspector(this.competitionId());
            }
        });
        
        // Model object for a single prospect
        entity("Prospect", {
            mixin: [ UserMixin ],
            meta: {
                url: new Property(),
                myVote: new Property(),
                post: new Reference("Post"),
                postSummary: new Computed(function () {
                    var post = this.post();
                    if (!post) return null;
                    return post.content().substr(0, 250);
                }),
                created: new Property(),
                updated: new Computed(function () {
                    var post = this.post();
                    return post ? post.created() : null;
                }),
                hero: new Reference("ProspectAttachment"),
                commentList: new Collection("ProspectComment"),
                commentCount: new Property(), // Explicit in this case
                slideList: new Collection("ProspectAttachment", {
                    Count: true,
                    IdList: true
                }),
                fileList: new Collection("ProspectAttachment", {
                    Count: true,
                    Order: function (a, b) {
                        return a.fileName() > b.fileName();
                    }
                }),
                voteCount: new Property(),
                voteAward: new Computed(function () {
                    // Synthetic award for getting votes
                    var voteCount = this.voteCount();
                    if (!voteCount) return null;

                    var created = this.created();
                    return new Kaggle.Model.ProspectAward({
                        id: 0,
                        awarded: created,
                        "class": "votes",
                        label: "Upvoted",
                        multiple: voteCount
                    });
                }),
                awardList: new Collection("ProspectAward"),
                awardOrder: new Computed(function () {
                    // Ordered award list, merging in synthetic awards
                    var awardList = this.awardList ? this.awardList() : [ ];
                    var voteAward = this.voteAward();
                    if (voteAward) awardList.push(voteAward);
                    return awardList.sort(function (a, b) {
                        return b.awarded - a.awarded;
                    });
                }),
                awardAny: new Computed(function () {
                    // Because of multiples and "vote awards" the idea of a
                    // award "count" is nebulous. But we can say if you got
                    // any of them for the sake of gui display.
                    return this.awardOrder().length ? true : false;
                })
            },
            initialize: function () {
                this.editUrl = ko.computed(function () {
                    return Kaggle.Url.prospectEdit(this);
                }, this);

                this.publishUrl = ko.computed(function () {
                    return Kaggle.Url.prospectPublish(this);
                }, this);
        
                this.saveUrl = ko.computed(function () {
                    return Kaggle.Url.prospectSave(this);
                }, this);
        
                this.retractUrl = ko.computed(function () {
                    return Kaggle.Url.prospectRetract(this);
                }, this);
        
                this.deleteUrl = ko.computed(function () {
                    return Kaggle.Url.prospectDelete(this);
                }, this);
            },
            divId: function () {
                return "knockout-prospect-" + this.id;
            },
            toSlidesJson: function () {
                return {
                    prospectFileId: this.slideIdList()
                };
            }
        });

        // Model object for prospect award
        entity("ProspectAward", {
            meta: {
                awarded: new Property(),
                name: new Property(),
                label: new Property(),
                multiple: new Property()
            },
            initialize: function () {
                this.labelText = ko.computed(function () {
                    var label = this.label();
                    var multiple = this.multiple();
                    if (multiple && multiple > 1) {
                        label = label + " x " + multiple;
                    }
                    return label;
                }, this);
            },
            divId: function () {
                return "knockout-prospect-award-" + this.id;
            }
        });

        // Model object for a prospect comment
        entity("ProspectComment", {
            mixin: [ UserMixin ],
            meta: {
                post: new Reference("Post")
            },
            divId: function () {
                return "knockout-prospect-comment-" + this.id;
            }
        });


        // Model object for a prospect file attachment
        entity("ProspectAttachment", {
            mixin: [ UserMixin ],
            meta: {
                url: new Property(),
                userId: new Property(),
                fileName: new Property(),
                fileSize: new Property(),
                mimeType: new Property(),
                created: new Property(),
                width: new Property(),
                height: new Property()
            },
            initialize: function () {
                this.fileSizeText = ko.computed(function () {
                    return Kaggle.Format.fileSize(this.fileSize());
                }, this);
            
                // Used for both CSS class and for if: conditions
                this.attachmentClass = ko.computed(function () {
                    var mimeType = this.mimeType();
                    if (mimeType) {
                        if (mimeType == "video/x-url") return "video";
                        if (mimeType == "image/jpeg") return "image";
                        if (mimeType == "image/jpg") return "image";
                        if (mimeType == "image/png") return "image";
                        if (mimeType == "image/gif") return "image";
                    }
                    return "file";
                }, this);
            
                this.isVideo = ko.computed(function () {
                    return this.attachmentClass() == "video";
                }, this);

                this.isImage = ko.computed(function () {
                    return this.attachmentClass() == "image";
                }, this);

                this.isFile = ko.computed(function () {
                    return this.attachmentClass() == "file";
                }, this);

                this.video = ko.computed(function () {
                    if (!this.isVideo) return null;
                    return Kaggle.Video.parse(this.fileName());
                }, this);
            },
            divId: function () {
                return "knockout-prospect-attachment-" + this.id;
            }
        });
    }
})(jQuery);
