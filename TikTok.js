with({
    copy
}) {
    var commentsDivXPath                 = '//div[contains(@class, "DivCommentListContainer")]';
    var allCommentsXPath                 = '//div[contains(@class, "DivCommentContentContainer")]';
    var level2CommentsXPath              = '//div[contains(@class, "DivReplyContainer")]';

    var publisherProfileUrlXPath         = '//span[contains(@class, "SpanUniqueId")]';
    var nicknameAndTimePublishedAgoXPath = '//span[contains(@class, "SpanOtherInfos")]';

    // we will filter these later because we have to handle them differently depending on what layout we have
    var likesCommentsSharesXPath         = "//strong[contains(@class, 'StrongText')]";

    var postUrlXPath                     = '//div[contains(@class, "CopyLinkText")]'
    var descriptionXPath                 = '//h4[contains(@class, "H4Link")]/preceding-sibling::div'

    // we need "View" or else this catches "Hide" too
    var viewMoreDivXPath                 = '//p[contains(@class, "PReplyAction") and contains(., "View")]';

    // more reliable than querySelector
    function getElementsByXPath(xpath, parent)
    {
        let results = [];
        let query = document.evaluate(xpath, parent || document,
            null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0, length = query.snapshotLength; i < length; ++i) {
            results.push(query.snapshotItem(i));
        }
        return results;
    }

    function getAllComments(){
        return getElementsByXPath(allCommentsXPath);
    }

    function quoteString(s) {
        return '"' + String(s).replaceAll('"', '""') + '"';
    }

    function getNickname(comment) {
        return getElementsByXPath('./div[1]/a', comment)[0].outerText;
    }

    function isReply(comment) {
        return comment.parentElement.className.includes('Reply')
    }

    // if there's an actual date, formats it as DD-MM-YYYY (though TikTok displays it as MM-DD)
    function formatDate(strDate) {
        if (typeof strDate !== 'undefined' && strDate !== null) {
            f = strDate.split('-');
            if (f.length == 1) {
                return strDate;
            } else if (f.length == 2) {
                return f[1] + '-' + f[0] + '-' + (new Date().getFullYear());
            } else if (f.length == 3) {
                return f[2] + '-' + f[1] + '-' + f[0];
            } else {
                return 'Malformed date';
            }
        } else {
            return 'No date';
        }
    }

    function extractNumericStats() {
        var strongTags = getElementsByXPath(likesCommentsSharesXPath);
        // the StrongText class is used on lots of things that aren't likes or comments; the last two or three are what we need
		// if it's a direct URL, shares are displayed, so we want the last three; if not, we only want the last two
        likesCommentsShares = parseInt(strongTags[(strongTags.length - 3)].outerText) ? strongTags.slice(-3) : strongTags.slice(-2);
        return likesCommentsShares;
    }

    function csvFromComment(comment) {
        nickname = getNickname(comment);
        user = getElementsByXPath('./a', comment)[0]['href'].split('?')[0].split('/')[3].slice(1);
        commentText = getElementsByXPath('./div[1]/p', comment)[0].outerText;
        timeCommentedAgo = formatDate(getElementsByXPath('./div[1]/p[2]/span', comment)[0].outerText);
        commentLikesCount = getElementsByXPath('./div[2]', comment)[0].outerText;
        pic = getElementsByXPath('./a/span/img', comment)[0] ? getElementsByXPath('./a/span/img', comment)[0]['src'] : "N/A";
        return quoteString(nickname) + ',' + quoteString(user) + ',' + 'https://www.tiktok.com/@' + user + ','
             + quoteString(commentText) + ',' + timeCommentedAgo + ',' + commentLikesCount + ',' + quoteString(pic);
    }

    // Loading 1st level comments
    var loadingCommentsBuffer = 30; // increase buffer if loading comments takes long and the loop breaks too soon
    var numOfcommentsBeforeScroll = getAllComments().length;
    while (loadingCommentsBuffer > 0) {

        allComments = getAllComments();
        lastComment = allComments[allComments.length - 1];
        lastComment.scrollIntoView(false);

        numOfcommentsAftScroll = getAllComments().length;

        // If number of comments doesn't change after 15 iterations, break the loop.
        if (numOfcommentsAftScroll !== numOfcommentsBeforeScroll) {
            loadingCommentsBuffer = 15;
        } else {
            // direct URLs can get jammed up because there's a recommended videos list that sometimes scrolls first, so scroll the div just in case
            commentsDiv = getElementsByXPath(commentsDivXPath)[0];
            commentsDiv.scrollIntoView(false);
            loadingCommentsBuffer--;
        };
        numOfcommentsBeforeScroll = numOfcommentsAftScroll;
        console.log('Loading 1st level comment number ' + numOfcommentsAftScroll);

        // Wait 0.3 seconds.
        await new Promise(r => setTimeout(r, 300));
    }
    console.log('Opened all 1st level comments');


    // Loading 2nd level comments
    loadingCommentsBuffer = 5; // increase buffer if loading comments takes long and the loop breaks too soon
    while (loadingCommentsBuffer > 0) {
        readMoreDivs = getElementsByXPath(viewMoreDivXPath);
        for (var i = 0; i < readMoreDivs.length; i++) {
            readMoreDivs[i].click();
        }

        await new Promise(r => setTimeout(r, 500));
        if (readMoreDivs.length === 0) {
            loadingCommentsBuffer--;
        } else {
            loadingCommentsBuffer = 5;
        }
        console.log('Buffer ' + loadingCommentsBuffer);
    }
    console.log('Opened all 2nd level comments');


    // Reading all comments, extracting and converting the data to csv
    var comments = getAllComments();
    var level2CommentsLength = getElementsByXPath(level2CommentsXPath).length;
    var publisherProfileUrl = getElementsByXPath(publisherProfileUrlXPath)[0].outerText;
    var nicknameAndTimePublishedAgo = getElementsByXPath(nicknameAndTimePublishedAgoXPath)[0].outerText.replaceAll('\n', ' ').split(' · ');

    // direct URLs don't include a place to copy the link (since it'd be redundant) so just grab the actual page URL
    var url = window.location.href.split('?')[0]
    var likesCommentsShares = extractNumericStats();
    var likes = likesCommentsShares[0].outerText;
    var totalComments = likesCommentsShares[1].outerText;

    // the pop-up search window interface doesn't include shares
    var shares = likesCommentsShares[2] ? likesCommentsShares[2].outerText : "N/A";
    var commentNumberDifference = Math.abs(parseInt(totalComments) - (comments.length));


    var csv = 'Now,' + Date() + '\n';
    csv += 'Post URL,' + url + '\n';
    csv += 'Publisher Nickname,' + nicknameAndTimePublishedAgo[0] + '\n';
    csv += 'Publisher @,' + publisherProfileUrl + '\n';
    csv += 'Publisher URL,' + "https://www.tiktok.com/@" + publisherProfileUrl + '\n';
    csv += 'Publish Time,' + formatDate(nicknameAndTimePublishedAgo[1]) + '\n';
    csv += 'Post Likes,' + likes + '\n';
    csv += 'Post Shares,' + shares + '\n';
    csv += 'Description,' + quoteString(getElementsByXPath(descriptionXPath)[0].outerText) + '\n';
    csv += 'Number of 1st level comments,' + (comments.length - level2CommentsLength) + '\n';
    csv += 'Number of 2nd level comments,' + level2CommentsLength + '\n';
    csv += '"Total Comments (actual, in this list, rendered in the comment section; needs all comments to be loaded!)",' + (comments.length) + '\n';
    csv += "Total Comments (which TikTok tells you; it's too high most of the time when dealing with many comments OR way too low because TikTok limits the number of comments to prevent scraping)," + totalComments + '\n';
    csv += "Difference," + commentNumberDifference + '\n';
    csv += 'Comment Number (ID),Nickname,User @,User URL,Comment Text,Time,Likes,Profile Picture URL,Is 2nd Level Comment,User Replied To,Number of Replies\n';

    var count = 1;
    var totalReplies = 0;
    var repliesSeen = 1; // Offset of replies from corresponding parent comment
    for (var i = 0; i < comments.length; i++) {
        csv += count + ',' + csvFromComment(comments[i]) + ',';
        if (i > 0 && isReply(comments[i])) {
            csv += "Yes," + quoteString(getNickname(comments[i - repliesSeen])) + ',0';
            repliesSeen += 1;
        }
        else {
            csv += 'No,---,';
            totalReplies = 0;
            repliesSeen = 1;
            // Replies always come after the first comment, so look ahead until we reach another top-level comment
            for (var j = 1; j < comments.length - i; j++) {
                if (!isReply(comments[i + j])) {
                    break;
                }
                totalReplies += 1;
            }
            csv += totalReplies;
        }
        csv += '\n';
        count++;
    }
    var apparentCommentNumber = parseInt(totalComments);
    console.log('Number of magically missing comments (not rendered in the comment section): ' + (apparentCommentNumber - count + 1) + ' (you have ' + (count - 1) + ' of ' + apparentCommentNumber + ')');
    console.log('CSV copied to clipboard!');

    // Export to CSV file instead of copying to clipboard
const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
const link = document.createElement("a");
link.href = URL.createObjectURL(blob);
link.download = "tiktok_comments.csv";
document.body.appendChild(link);
link.click();
document.body.removeChild(link);

console.log(`✅ Downloaded ${count - 1} comments as 'tiktok_comments.csv'`);
}
