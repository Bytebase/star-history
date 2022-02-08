import GhostContentAPI, { Params, PostOrPage } from "@tryghost/content-api";
import utils from "./utils";

type ResponseType<T = unknown> = {
  response: Response;
  data: T;
};

type RequestConfig = {
  method: string;
  url: string;
  data?: any;
  headers?: HeadersInit;
};

const PER_PAGE = 30;

async function request<T>(config: RequestConfig): Promise<ResponseType<T>> {
  const { method, url, data } = config;
  const requestConfig: RequestInit = {
    method,
  };

  if (data !== undefined) {
    requestConfig.headers = {
      "Content-Type": "application/json",
    };
    requestConfig.body = JSON.stringify(data);
  }

  if (config.headers) {
    requestConfig.headers = {
      ...requestConfig.headers,
      ...config.headers,
    };
  }

  return fetch(url, requestConfig)
    .then(async (response) => {
      if (response.status >= 400 && response.status < 600) {
        throw {
          response,
          data: null,
        };
      }
      const responseData = (await response.json()) as T;
      return {
        response,
        data: responseData,
      };
    })
    .catch((error) => {
      return Promise.reject(error);
    });
}

namespace api {
  export async function getRepoStargazers(
    repo: string,
    token = "",
    page?: number
  ) {
    let url = `https://api.github.com/repos/${repo}/stargazers?per_page=${PER_PAGE}`;

    if (page !== undefined) {
      url = `${url}&page=${page}`;
    }
    return request<{ starred_at: string }[]>({
      method: "GET",
      url,
      headers: {
        Accept: "application/vnd.github.v3.star+json",
        Authorization: token ? `token ${token}` : "",
      },
    });
  }

  export async function getRepoStargazersCount(repo: string, token = "") {
    return request<{ stargazers_count: number }>({
      method: "GET",
      url: `https://api.github.com/repos/${repo}`,
      headers: {
        Accept: "application/vnd.github.v3.star+json",
        Authorization: token ? `token ${token}` : "",
      },
    });
  }

  export async function getRepoStarRecords(repo: string, token = "") {
    const patchRes = await getRepoStargazers(repo, token);

    const headerLink = patchRes.response.headers.get("link") || "";
    const MAX_REQUEST_AMOUNT = 15;

    let pageCount = 1;
    const regResult = /next.*&page=(\d*).*last/.exec(headerLink);

    if (regResult) {
      if (regResult[1] && Number.isInteger(Number(regResult[1]))) {
        pageCount = Number(regResult[1]);
      }
    }

    if (pageCount === 1 && patchRes?.data?.length === 0) {
      throw {
        response: patchRes.response,
        data: [],
      };
    }

    const requestPages: number[] = [];
    if (pageCount < MAX_REQUEST_AMOUNT) {
      requestPages.push(...utils.range(1, pageCount));
    } else {
      utils.range(1, MAX_REQUEST_AMOUNT).map((i) => {
        requestPages.push(Math.round((i * pageCount) / MAX_REQUEST_AMOUNT) - 1);
      });
      if (!requestPages.includes(1)) {
        requestPages.unshift(1);
      }
    }

    const resArray = await Promise.all(
      requestPages.map((page) => {
        return getRepoStargazers(repo, token, page);
      })
    );

    const starRecordsMap: Map<string, number> = new Map();

    if (requestPages.length < MAX_REQUEST_AMOUNT) {
      const starRecordsData: {
        starred_at: string;
      }[] = [];
      resArray.map((res) => {
        const { data } = res;
        starRecordsData.push(...data);
      });
      for (let i = 0; i < starRecordsData.length; ) {
        starRecordsMap.set(
          utils.getDateString(starRecordsData[i].starred_at),
          i + 1
        );
        i += Math.floor(starRecordsData.length / MAX_REQUEST_AMOUNT) || 1;
      }
    } else {
      resArray.map(({ data }, index) => {
        if (data.length > 0) {
          const starRecord = data[0];
          starRecordsMap.set(
            utils.getDateString(starRecord.starred_at),
            PER_PAGE * (requestPages[index] - 1)
          );
        }
      });
    }

    const { data } = await getRepoStargazersCount(repo, token);

    starRecordsMap.set(utils.getDateString(Date.now()), data.stargazers_count);

    const starRecords: {
      date: string;
      count: number;
    }[] = [];

    starRecordsMap.forEach((v, k) => {
      starRecords.push({
        date: k,
        count: v,
      });
    });

    return starRecords;
  }

  // Create API instance with site credentials
  const ghostContentAPI = new GhostContentAPI({
    url: "https://bytebase.ghost.io",
    key: "f3ffa1aa4e40b7999486ef97e5",
    version: "v3",
  });

  export async function getPosts(
    tagList?: string[],
    page?: number
  ): Promise<PostOrPage[]> {
    const params: Params = {
      limit: "all",
      include: ["tags", "authors"],
      order: "published_at DESC",
    };

    if (tagList && tagList.length > 0) {
      params.filter = `tag:[${tagList.join(", ")}]`;
    }

    if (page) {
      params.page = page;
    }

    return await ghostContentAPI.posts.browse(params).catch((err) => {
      console.error(err);
      throw err;
    });
  }

  export async function getPostDetailBySlug(
    postSlug: string
  ): Promise<PostOrPage> {
    return await ghostContentAPI.posts
      .read(
        {
          slug: postSlug,
        },
        {
          include: ["tags", "authors"],
        }
      )
      .catch((err) => {
        console.error(err);
        throw err;
      });
  }

  export async function subscribeBlog(email: string) {
    return fetch(
      "https://newsletter.bytebase.com/members/api/send-magic-link/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          name: "",
          requestSrc: "bytebase.com",
        }),
      }
    );
  }
}

export default api;
