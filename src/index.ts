import {
    Canister,
    query,
    text,
    update,
    Record,
    Opt,
    Vec,
    nat64,
    StableBTreeMap,
    Principal,
    Err,
    Ok,
    Result,
    ic,
} from 'azle';

const BlogPost = Record({
    id: Principal,
    title: text,
    content: text,
    author: text,
    commentIds: Vec(Principal),
    createdAt: nat64,
});

const BlogPostPayload = Record({
    title: text,
    content: text,
    author: text,
});

const Comment = Record({
    id: Principal,
    authorName: text,
    content: text,
    createdAt: nat64,
    blogPostId: Principal,
});

const CommentPayload = Record({
    authorName: text,
    content: text,
});

//make stable to persist state on updates
const blogPostStorage = StableBTreeMap(Principal, BlogPost, 1);
const commentStorage = StableBTreeMap(Principal, Comment, 2);

export default Canister({

    getBlogPosts: query([], Result(Vec(BlogPost), text), () => {
        return Ok(blogPostStorage.values());
    }),

    getSingleBlogPost: query([Principal], Result(Opt(BlogPost), text), (id) => {
        const blogPost = blogPostStorage.get(id);
        if (!blogPost) {
            return Err(`a blog post with id=${id} not found`);
        }

        return Ok(blogPost);
    }),

    createBlogPost: update([BlogPostPayload], Result(text, text), (payload) => {
        const blogPost: typeof BlogPost = {
            id: generateId(),
            createdAt: ic.time(),
            commentIds: [],
            ...payload,
        }
        blogPostStorage.insert(blogPost.id, blogPost);

        return Ok('blog post created successfully');
    }),

    updateBlogPost: update([BlogPostPayload, Principal], Result(text, text), (payload, blogPostID) => {
        const blogPostOpt = blogPostStorage.get(blogPostID);
        if ('None' in blogPostOpt) {
            return Err(`a blog post with id=${blogPostID} not found`);
        }

        const blogPost = blogPostOpt.Some;

        const updatedBlogPost: typeof BlogPost = {
            ...blogPost,
            ...payload,
        };

        blogPostStorage.insert(blogPost.id, updatedBlogPost);

        return Ok('blog post updated successfully');
    }),

    deleteBlogPost: update([Principal], Result(text, text), (id) => {
        if (!blogPostStorage.get(id)) {
            return Err(`a blog post with id=${id} not found`);
        }

        blogPostStorage.remove(id);
        return Ok('blog post deleted successfully');
    }),

    // COMMENTS
    addComment: update([CommentPayload, Principal], Result(text, text), (payload, blogPostID) => {
        const blogPostOpt = blogPostStorage.get(blogPostID);
        if ('None' in blogPostOpt) {
            return Err(`a blog post with id=${blogPostID} not found`);
        }

        const blogPost = blogPostOpt.Some;

        const comment: typeof Comment = {
            id: generateId(),
            blogPostId: blogPost.id,
            createdAt: ic.time(),
            ...payload,
        };

        commentStorage.insert(comment.id, comment);
        blogPost.commentIds.push(comment.id);
        blogPostStorage.insert(blogPost.id, blogPost);

        return Ok('comment created successfully');
    }),

    getCommentsByBlogPost: query([Principal], Result(Vec(Comment), text), (blogPostID) => {
        const blogPostOpt = blogPostStorage.get(blogPostID);
        if ('None' in blogPostOpt) {
            return Err(`a blog post with id=${blogPostID} not found`);
        }

        const blogPost = blogPostOpt.Some;
        const blogPostComments = commentStorage.values().filter(
            (comment: typeof Comment) =>
                comment.blogPostId.toText() === blogPost.id.toText()
        );

        return Ok(blogPostComments);
    })
});

function generateId(): Principal {
    const randomBytes = new Array(29)
        .fill(0)
        .map((_) => Math.floor(Math.random() * 256));

    return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    },
};
