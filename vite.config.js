export default {
    server: {
        host: true,
        proxy: {
            '/api': 'http://localhost:3030',
            '/download': 'http://localhost:3030'
        }
    }
}
