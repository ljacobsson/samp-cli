const inputUtil = require("../../shared/inputUtil");
const jp = require("jsonpath");
const runtimes = require("../../shared/runtimes.json");
const { Separator } = require("inquirer");
const _ = require("lodash");
async function transform(templ, runtime) {
    const metadata = templ.Metadata;
    if (!metadata || !metadata.PatternTransform) {
        return templ;
    }
    console.log("Applying transforms...");
    let { template, selectedRuntime } = await propertyTransforms(templ);
    selectedRuntime = selectedRuntime || runtime;
    template = await metadataTransforms(template, selectedRuntime);
    template = await placeholderTransforms(template);
    return { template, selectedRuntime };
}

async function metadataTransforms(template, runtime) {

    const funcs = Object.keys(template.Resources).filter(p => template.Resources[p].Type === "AWS::Serverless::Function");
    if (funcs.length) {
        console.log(runtime.metadataPromptTitle);
    }
    for (const func of funcs) {
        if (!runtime.metadata) {
            delete template.Resources[func].Metadata;
            continue;
        }

        const properties = {}
        for (const property of Object.keys(runtime.metadata.Properties || {})) {
            const prop = runtime.metadata.Properties[property];
            if (prop.Prompt) {
                const value = properties[property] || await inputUtil.text(`Value for ${property}`, prop.Default);
                if (value !== prop.Default) {
                    runtime.metadata.Properties[property] = value;
                } else {
                    delete runtime.metadata.Properties[property];
                }
                properties[property] = value;
            }
        }
        if (runtime.metadata.Properties && !Object.keys(runtime.metadata.Properties).length) {
            delete runtime.metadata.Properties;
        }
        template.Resources[func].Metadata = _.merge(template.Resources[func].Metadata, runtime.metadata);
    }
    return template;
}

async function placeholderTransforms(template) {
    const metadata = template.Metadata;

    let templateString = JSON.stringify(template);
    for (const property of metadata.PatternTransform.Placeholders || []) {
        const value = await inputUtil.text(
            property.Message || `Placeholder value for ${property.Placeholder}:`
        );
        templateString = templateString.replaceAll(property.Placeholder, value);
    }
    return JSON.parse(templateString);
}
async function propertyTransforms(template) {
    let selectedRuntime;
    const metadata = template.Metadata;
    for (const property of metadata.PatternTransform.Properties || []) {
        try {

            if (!jp.query(template, property.JSONPath).length) continue;
            let defaultValue, value;
            switch (property.InputType) {
                case "number":
                    defaultValue = jp.query(template, property.JSONPath);
                    value = parseInt(
                        await inputUtil.text(
                            `${property.Message || "Set value for " + property.JSONPath}:`,
                            defaultValue.length ? defaultValue[0] : undefined
                        )
                    );

                    break;
                case "string":
                case "text":
                    defaultValue = jp.query(template, property.JSONPath);
                    value = await inputUtil.text(
                        property.Message,
                        defaultValue.length ? defaultValue[0] : undefined
                    );
                    break;
                case "runtime-select":
                    value = selectedRuntime ||
                        process.env.SAM_PATTERNS_DEFAULT_RUNTIME ||
                        (await inputUtil.autocomplete(
                            `Select Lambda runtime for ${JSONPathToFriendlyName(
                                property.JSONPath
                            )}.`,
                            [
                                ...runtimes.filter((p) => p.latest).map(p => { return { name: p.languageName ? `${p.name} (${p.languageName})` : p.name, value: p } }),
                                new Separator("*** Older versions ***"),
                                ...runtimes.filter((p) => !p.latest).map(p => { return { name: p.languageName || p.name, value: p } }),
                            ]
                        ));
                    selectedRuntime = value;
                    break;
            }
            if (value) jp.value(template, property.JSONPath, value.name);
        } catch (err) {
            console.log("Could not parse path " + property.JSONPath);
        }
    }
    return { template, selectedRuntime };
}

function JSONPathToFriendlyName(jsonPath) {
    const split = jsonPath.split(".");
    if (split[1] === "Globals") return "Globals";
    else return "function " + split[2];
}

module.exports = {
    transform,
};
