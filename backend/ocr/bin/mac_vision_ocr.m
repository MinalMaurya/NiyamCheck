#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc < 2) {
            printf("[]\n");
            return 0;
        }

        NSString *imagePath = [NSString stringWithUTF8String:argv[1]];
        NSURL *imageURL = [NSURL fileURLWithPath:imagePath];

        NSDictionary *options = @{};
        VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithURL:imageURL options:options];

        VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] init];
        request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
        request.usesLanguageCorrection = YES;

        NSError *error = nil;
        [handler performRequests:@[request] error:&error];
        if (error || !request.results) {
            printf("[]\n");
            return 0;
        }

        NSMutableArray *results = [NSMutableArray array];
        for (VNRecognizedTextObservation *obs in request.results) {
            VNRecognizedText *topText = [[obs topCandidates:1] firstObject];
            if (topText && topText.string.length > 0) {
                CGRect bbox = obs.boundingBox;
                double xmin = MAX(0.0, MIN(1.0, (double)bbox.origin.x));
                double xmax = MAX(0.0, MIN(1.0, (double)(bbox.origin.x + bbox.size.width)));
                double ymin = MAX(0.0, MIN(1.0, 1.0 - (double)(bbox.origin.y + bbox.size.height)));
                double ymax = MAX(0.0, MIN(1.0, 1.0 - (double)bbox.origin.y));

                if (ymin > ymax) { double tmp = ymin; ymin = ymax; ymax = tmp; }
                if (xmin > xmax) { double tmp = xmin; xmin = xmax; xmax = tmp; }

                NSDictionary *item = @{
                    @"text": topText.string,
                    @"confidence": @(round(topText.confidence * 100.0) / 100.0),
                    @"box": @[
                        @(round(ymin * 10000.0) / 10000.0),
                        @(round(xmin * 10000.0) / 10000.0),
                        @(round(ymax * 10000.0) / 10000.0),
                        @(round(xmax * 10000.0) / 10000.0)
                    ]
                };
                [results addObject:item];
            }
        }

        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:results options:0 error:nil];
        if (jsonData) {
            NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
            printf("%s\n", [jsonString UTF8String]);
        } else {
            printf("[]\n");
        }
    }
    return 0;
}
