import React, { useEffect, useState } from "react"
import axios from "axios"
import { FaGithub } from "react-icons/fa"

const GitHubStarButton = () => {
    const [starCount, setStarCount] = useState(0)

    useEffect(() => {
        const getRepoStarCount = async () => {
            let count = 0;
            try {
                const { data } = await axios.get(`https://api.github.com/repos/star-history/star-history`, {
                    headers: {
                        Accept: "application/vnd.github.v3.star+json",
                        Authorization: ""
                    }
                })
                count = data.stargazers_count;
            } catch (error) {
              // 
            }
            return count;
        }

        getRepoStarCount().then((count) => setStarCount(count))
    }, [])

    return (
        <a
            className="border rounded flex flex-row justify-start items-center text-black bg-white text-sm shadow-inner hover:opacity-80"
            href="https://github.com/star-history/star-history"
            target="_blank"
            aria-label="Star star-history/star-history on GitHub"
        >
            <span className="pr-1 pl-2 h-full flex flex-row justify-center items-center bg-gray-100 border-r font-medium">
                <FaGithub className="fab text-base mr-1 -mt-px" />
                <span className="mt-px">Star</span>
            </span>
            <div className="h-full block px-2 mt-px font-medium">{starCount === 0 ? <i className="fa fa-spinner animate-spin opacity-90 px-2"></i> : <span>{starCount}</span>}</div>
        </a>
    )
}

export default GitHubStarButton