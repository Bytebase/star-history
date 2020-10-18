import axios from 'axios';

// number of sample requests to do
const sampleNum = 15;

// return [1,2, ..., n]
const range = n => Array.apply(null, {length: n}).map((_, i) => i + 1);

/**
 * get star history
 * @param {String} repo - eg: 'timqian/jsCodeStructure'
 * @param {String} token - github access token
 * @return {Array} history - eg: [{date: 2015-3-1,starNum: 12}, ...]
 */
async function getStarHistory(repo, token) {
  const axiosGit = axios.create({
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: token ? `token ${token}` : undefined,
    },
  });

  /**
   * generate Urls and pageNums
   * @param {sting} repo - eg: 'timqian/jsCodeStructure'
   * @return {object} {sampleUrls, pageIndexes} - urls to be fatched(length <=10) and page indexes
   */
  async function generateUrls(repo) {

    const initUrl = `https://api.github.com/repos/${repo}/stats/contributors`;   // used to get star info
    const initRes = await axiosGit.get(initUrl);

    /** 
     * link Sample (no link when star < 30):
     * <https://api.github.com/repositories/40237624/contributers?access_token=2e71ec1017dda2220ccba0f6922ecefd9ea44ac7&page=2>;
     * rel="next", 
     * <https://api.github.com/repositories/40237624/contributers?access_token=2e71ec1017dda2220ccba0f6922ecefd9ea44ac7&page=4>; 
     * rel="last"
     */
    const link = initRes.headers.link;
    console.log(initRes.headers.link)

    const pageNum = link ? /next.*?page=(\d*).*?last/.exec(link)[1] : 1; // total page number

    // used to calculate total stars for this page
    const pageIndexes = pageNum <= sampleNum ?
      range(pageNum).slice(1, pageNum) :
      range(sampleNum).map(n => Math.round(n / sampleNum * pageNum) - 1); // for bootstrap bug

    // store sampleUrls to be requested
    const sampleUrls = pageIndexes.map(pageIndex => `${initUrl}?page=${pageIndex}`);

    console.log("pageIndexes", pageIndexes);
    return { firstPage: initRes, sampleUrls, pageIndexes };
  }

  const { sampleUrls, pageIndexes, firstPage } = await generateUrls(repo);

  // promises to request sampleUrls

  const getArray = [firstPage].concat(sampleUrls.map(url => axiosGit.get(url)));

  const resArray = await Promise.all(getArray);
  console.log("resArray: ", resArray)

  let starHistory = null;

  if (pageIndexes[pageIndexes.length - 1] > sampleNum) {
    starHistory = pageIndexes.map((p, i) => {
      var j;
      for (j = 0; j < resArray[i + 1].data[0].weeks.length; j++) {
        var week = resArray[i + 1].data[0].weeks[j];
        if(week.a != 0 || week.d != 0 || week.c != 0) {
          resArray[i + 1].data[0].starred_at = new Date(week.w * 1000).toISOString();
          break;
        }
      }
      return {
        date: resArray[i + 1].data[0].starred_at.slice(0, 10),
        starNum: 30 * ((p === 0 ? 1 : p) - 1), // page 0 also means page 1
      };
    });
  } else {
    // we have every starredEvent: we can use them to generate 15 (sampleNum) precise points
    const starredEvents = resArray.reduce((acc, r) => acc.concat(r.data), []);
    var i, j;
    for (i = 0; i < starredEvents.length; i++) {
      for (j = 0; j < starredEvents[i].weeks.length; j++) {
        var week = starredEvents[i].weeks[j];
        if(week.a != 0 || week.d != 0 || week.c != 0) {
          starredEvents[i].starred_at = new Date(starredEvents[i].weeks[j].w * 1000).toISOString();
          break;
        }
      }
    }
    starredEvents.sort(function(a, b) {
      if (a.starred_at < b.starred_at) {
        return -1;
      }
      if (a.starred_at > b.starred_at) {
        return 1;
      }
      return 0;
    });
    console.log("starredEvents: ", starredEvents)

    const firstStarredAt = new Date(starredEvents[0].starred_at);
    const daysSinceRepoCreatedAt = Math.round((new Date()) - firstStarredAt) / (1000*60*60*24);

    const dates = Array.from(new Array(50)).map((_, i) => {
      const firstStarredAtCopy = new Date(firstStarredAt);
      firstStarredAtCopy.setDate(firstStarredAtCopy.getDate() + Math.floor((daysSinceRepoCreatedAt / 50) * (i + 1)));
      return firstStarredAtCopy.toISOString().slice(0, 10);
    }, []);

    starHistory = dates.map((d, i) => {
      let starNum = 0;
      const firstStarredEventAfterDate = starredEvents.find((se, i) => {
        if (se.starred_at.slice(0, 10) >= d) {
          starNum = i + 1;
          return true
        }

        return false;
      })

      return firstStarredEventAfterDate && {
        date: firstStarredEventAfterDate.starred_at.slice(0, 10),
        starNum: starNum
      };
    }).filter(x => x);
  }


  return starHistory;
}

export default getStarHistory;
