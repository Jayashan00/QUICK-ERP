package com.quickerp.web;

import com.quickerp.core.FileStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Upload (signed-in users) and download (by link) of stored files. */
@RestController
public class FileController {

    private final FileStore fileStore;

    public FileController(FileStore fileStore) {
        this.fileStore = fileStore;
    }

    @PostMapping("/files")
    public FileStore.Stored upload(@RequestParam("file") MultipartFile file, HttpServletRequest request) throws IOException {
        return fileStore.save(AuthInterceptor.principal(request), file.getOriginalFilename(), file.getContentType(), file.getBytes());
    }

    @GetMapping("/files/{id}")
    public void download(@PathVariable("id") String id, @RequestParam(name = "key", required = false) String key,
                         HttpServletResponse response) throws IOException {
        FileStore.Content content = fileStore.read(id, key);
        String asciiName = content.fileName().replaceAll("[^A-Za-z0-9._ -]", "_");
        String encodedName = URLEncoder.encode(content.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
        response.setContentType(content.contentType());
        response.setHeader("Content-Disposition", (content.inline() ? "inline" : "attachment")
                + "; filename=\"" + asciiName + "\"; filename*=UTF-8''" + encodedName);
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
        response.setHeader("Cache-Control", "private, max-age=86400");
        response.setContentLength(content.bytes().length);
        response.getOutputStream().write(content.bytes());
    }
}
